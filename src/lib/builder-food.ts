import "server-only";

import type { Prisma } from "@prisma/client";
import type { BuilderFood, BuilderMeal } from "@/lib/meal-builder";

export const foodInclude = {
  nutrients: { include: { nutrient: true } },
} satisfies Prisma.FoodInclude;

type FoodWithNutrients = Prisma.FoodGetPayload<{ include: typeof foodInclude }>;

export function toBuilderFood(food: FoodWithNutrients): BuilderFood {
  if (food.nutrientBasis !== "g" && food.nutrientBasis !== "ml" && food.nutrientBasis !== "unit" && food.nutrientBasis !== "unknown") throw new Error("Invalid stored nutrient basis.");
  const parsed: unknown = JSON.parse(food.portionsJson);
  if (!Array.isArray(parsed)) throw new Error("Invalid stored food portions.");
  const portions: BuilderFood["portions"] = parsed.map((portion: unknown): BuilderFood["portions"][number] => {
    if (
      typeof portion !== "object" || portion === null ||
      !("label" in portion) || typeof portion.label !== "string" ||
      !("basis" in portion) || (portion.basis !== "g" && portion.basis !== "ml") ||
      !("amount" in portion) || typeof portion.amount !== "number" ||
      !Number.isFinite(portion.amount) || portion.amount <= 0
    ) throw new Error("Invalid stored food portion.");
    return { label: portion.label, basis: portion.basis, amount: portion.amount };
  });
  return {
    id: food.id,
    fdcId: food.fdcId,
    name: food.name,
    basis: food.nutrientBasis,
    defaultAmount: food.defaultAmount,
    defaultUnit: food.defaultUnit,
    portions,
    nutrients: food.nutrients.map(({ nutrient, per100Unit, derivation }) => ({
      id: nutrient.id,
      name: nutrient.name,
      unit: nutrient.unit,
      value: per100Unit,
      derivation,
    })),
  };
}

export const mealInclude = {
  entries: { include: { food: { include: foodInclude } }, orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.MealInclude;

type MealWithFoods = Prisma.MealGetPayload<{ include: typeof mealInclude }>;

export function toBuilderMeal(meal: MealWithFoods, userId: string): BuilderMeal {
  return {
    id: meal.id,
    name: meal.name,
    entries: meal.entries.map((entry) => {
      if (entry.food.ownerId && entry.food.ownerId !== userId) throw new Error("Meal contains an inaccessible food.");
      if (entry.basis !== "g" && entry.basis !== "ml" && entry.basis !== "unit") throw new Error("Meal contains an invalid nutrient basis.");
      return {
        key: entry.id, food: toBuilderFood(entry.food), quantity: entry.quantity,
        unitLabel: entry.unitLabel, basisPerUnit: entry.basisPerUnit, basis: entry.basis,
      };
    }),
  };
}

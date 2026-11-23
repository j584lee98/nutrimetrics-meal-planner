import type { BuilderEntry, BuilderMeal } from "@/lib/meal-builder";

export type NutrientTotal = { value: number; partial: boolean } | null;

export function entryValue(entry: BuilderEntry, nutrientId: number): number | null {
  const nutrient = entry.food.nutrients.find((item) => item.id === nutrientId);
  return nutrient ? nutrient.value * entry.quantity * entry.basisPerUnit / 100 : null;
}

export function mealTotal(meal: BuilderMeal, nutrientId: number): NutrientTotal {
  const amounts = meal.entries.map((entry) => entryValue(entry, nutrientId));
  const available = amounts.filter((value): value is number => value !== null);
  return available.length ? { value: available.reduce((sum, value) => sum + value, 0), partial: available.length < amounts.length } : null;
}

export function planTotal(meals: BuilderMeal[], nutrientId: number): NutrientTotal {
  const values = meals.map((meal) => mealTotal(meal, nutrientId));
  const available = values.filter((value): value is NonNullable<NutrientTotal> => value !== null);
  return available.length ? {
    value: available.reduce((sum, value) => sum + value.value, 0),
    partial: available.length < values.length || available.some((value) => value.partial),
  } : null;
}

export function displayTotal(total: NutrientTotal) {
  return total ? `${total.value.toLocaleString(undefined, { maximumSignificantDigits: 6 })}${total.partial ? " (partial)" : ""}` : "—";
}

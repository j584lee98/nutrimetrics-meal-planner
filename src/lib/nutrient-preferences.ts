import "server-only";

import { db } from "@/lib/db";
import { defaultNutrients, type NutrientColumn } from "@/lib/meal-builder";

// FoodData Central nutrient IDs, names and units.
const commonNutrients: NutrientColumn[] = [
  ...defaultNutrients,
  { id: 1079, name: "Fiber, total dietary", unit: "g" },
  { id: 2000, name: "Sugars, total including NLEA", unit: "g" },
  { id: 1258, name: "Fatty acids, total saturated", unit: "g" },
  { id: 1253, name: "Cholesterol", unit: "mg" },
  { id: 1087, name: "Calcium", unit: "mg" },
  { id: 1089, name: "Iron", unit: "mg" },
  { id: 1090, name: "Magnesium", unit: "mg" },
  { id: 1091, name: "Phosphorus", unit: "mg" },
  { id: 1092, name: "Potassium", unit: "mg" },
  { id: 1093, name: "Sodium", unit: "mg" },
  { id: 1095, name: "Zinc", unit: "mg" },
  { id: 1098, name: "Copper", unit: "mg" },
  { id: 1101, name: "Manganese", unit: "mg" },
  { id: 1103, name: "Selenium", unit: "µg" },
  { id: 1106, name: "Vitamin A, RAE", unit: "µg" },
  { id: 1109, name: "Vitamin E", unit: "mg" },
  { id: 1114, name: "Vitamin D", unit: "µg" },
  { id: 1162, name: "Vitamin C", unit: "mg" },
  { id: 1165, name: "Thiamin", unit: "mg" },
  { id: 1166, name: "Riboflavin", unit: "mg" },
  { id: 1167, name: "Niacin", unit: "mg" },
  { id: 1170, name: "Pantothenic acid", unit: "mg" },
  { id: 1175, name: "Vitamin B-6", unit: "mg" },
  { id: 1177, name: "Folate, total", unit: "µg" },
  { id: 1178, name: "Vitamin B-12", unit: "µg" },
  { id: 1180, name: "Choline", unit: "mg" },
  { id: 1185, name: "Vitamin K", unit: "µg" },
];

function parsePreferences(value: string | null): NutrientColumn[] {
  if (value === null) return defaultNutrients;
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) =>
    typeof item !== "object" || item === null || !Number.isSafeInteger(item.id) ||
    item.id <= 0 || typeof item.name !== "string" || typeof item.unit !== "string")) {
    throw new Error("Invalid stored nutrient preferences");
  }
  return parsed;
}

export async function getNutrientPreferences(userId: string): Promise<NutrientColumn[]> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { nutrientPreferences: true } });
  return parsePreferences(user.nutrientPreferences);
}

export async function getNutrientCatalog(userId: string): Promise<NutrientColumn[]> {
  const [stored, selected] = await Promise.all([
    db.nutrient.findMany({
      where: { OR: [
        { foods: { some: { food: { OR: [{ ownerId: null }, { ownerId: userId }] } } } },
        { overrides: { some: { userId } } },
      ] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    getNutrientPreferences(userId),
  ]);
  const catalog = new Map(commonNutrients.map((nutrient) => [nutrient.id, nutrient]));
  for (const nutrient of stored) if (!catalog.has(nutrient.id)) catalog.set(nutrient.id, nutrient);
  for (const nutrient of selected) if (!catalog.has(nutrient.id)) catalog.set(nutrient.id, nutrient);
  return [...catalog.values()];
}

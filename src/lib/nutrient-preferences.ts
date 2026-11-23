import "server-only";

import { db } from "@/lib/db";
import { defaultNutrients, type NutrientColumn } from "@/lib/meal-builder";

// One FoodData Central measure per commonly tracked nutrient; distinct forms are not interchangeable.
export const nutrientCatalog: NutrientColumn[] = [
  ...defaultNutrients,
  { id: 1079, name: "Fiber", unit: "g" },
  { id: 2000, name: "Total Sugars", unit: "g" },
  { id: 1235, name: "Added Sugars", unit: "g" },
  { id: 1258, name: "Saturated Fat", unit: "g" },
  { id: 1257, name: "Trans Fat", unit: "g" },
  { id: 1292, name: "Monounsaturated Fat", unit: "g" },
  { id: 1293, name: "Polyunsaturated Fat", unit: "g" },
  { id: 1253, name: "Cholesterol", unit: "mg" },
  { id: 1087, name: "Calcium", unit: "mg" },
  { id: 1089, name: "Iron", unit: "mg" },
  { id: 1090, name: "Magnesium", unit: "mg" },
  { id: 1091, name: "Phosphorus", unit: "mg" },
  { id: 1092, name: "Potassium", unit: "mg" },
  { id: 1093, name: "Sodium", unit: "mg" },
  { id: 1095, name: "Zinc", unit: "mg" },
  { id: 1096, name: "Chromium", unit: "µg" },
  { id: 1098, name: "Copper", unit: "mg" },
  { id: 1099, name: "Fluoride", unit: "µg" },
  { id: 1100, name: "Iodine", unit: "µg" },
  { id: 1101, name: "Manganese", unit: "mg" },
  { id: 1102, name: "Molybdenum", unit: "µg" },
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
  { id: 1176, name: "Biotin", unit: "µg" },
  { id: 1177, name: "Folate (total)", unit: "µg" },
  { id: 1178, name: "Vitamin B-12", unit: "µg" },
  { id: 1180, name: "Choline", unit: "mg" },
  { id: 1185, name: "Vitamin K (K1)", unit: "µg" },
];

const catalogById = new Map(nutrientCatalog.map((nutrient) => [nutrient.id, nutrient]));

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

export async function getNutrientPreferenceState(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { nutrientPreferences: true } });
  const saved = parsePreferences(user.nutrientPreferences);
  const columns = saved.map((nutrient) => catalogById.get(nutrient.id)).filter((nutrient): nutrient is NutrientColumn => nutrient !== undefined);
  return { columns, hiddenCount: saved.length - columns.length };
}

export async function getNutrientPreferences(userId: string): Promise<NutrientColumn[]> {
  return (await getNutrientPreferenceState(userId)).columns;
}

export type NutrientBasis = "g" | "ml" | "unit" | "unknown";

export type NutrientColumn = { id: number; name: string; unit: string };

export type BuilderFood = {
  id: string;
  fdcId: number | null;
  name: string;
  basis: NutrientBasis;
  portions: { label: string; basis: "g" | "ml"; amount: number }[];
  nutrients: { id: number; name: string; unit: string; value: number; derivation: string | null }[];
  defaultAmount: number | null;
  defaultUnit: string | null;
};

export type BuilderEntry = {
  key: string;
  food: BuilderFood;
  quantity: number;
  unitLabel: string;
  basisPerUnit: number;
  basis: "g" | "ml" | "unit";
};

export type BuilderMeal = {
  id: string;
  name: string;
  entries: BuilderEntry[];
};

export const defaultNutrients = [
  { id: 1008, name: "Calories", unit: "kcal" },
  { id: 1003, name: "Protein", unit: "g" },
  { id: 1005, name: "Carbohydrates", unit: "g" },
  { id: 1004, name: "Total Fat", unit: "g" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBuilderFood(value: unknown): value is BuilderFood {
  if (!isRecord(value) || typeof value.id !== "string" ||
      !(value.fdcId === null || (typeof value.fdcId === "number" && Number.isSafeInteger(value.fdcId) && value.fdcId > 0)) ||
      typeof value.name !== "string" || (value.basis !== "g" && value.basis !== "ml" && value.basis !== "unit" && value.basis !== "unknown") ||
      !(value.defaultAmount === null || (typeof value.defaultAmount === "number" && Number.isFinite(value.defaultAmount) && value.defaultAmount > 0)) ||
      !(value.defaultUnit === null || (typeof value.defaultUnit === "string" && value.defaultUnit.trim().length > 0)) ||
      !Array.isArray(value.portions) || !Array.isArray(value.nutrients)) return false;
  return value.portions.every((portion: unknown) => isRecord(portion) && typeof portion.label === "string" &&
    (portion.basis === "g" || portion.basis === "ml") && typeof portion.amount === "number" &&
    Number.isFinite(portion.amount) && portion.amount > 0) &&
    value.nutrients.every((nutrient: unknown) => isRecord(nutrient) && typeof nutrient.id === "number" &&
      Number.isSafeInteger(nutrient.id) && nutrient.id > 0 && typeof nutrient.name === "string" &&
      typeof nutrient.unit === "string" && typeof nutrient.value === "number" && Number.isFinite(nutrient.value) &&
      nutrient.value >= 0 && (nutrient.derivation === null || typeof nutrient.derivation === "string"));
}

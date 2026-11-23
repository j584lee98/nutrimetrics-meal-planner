export const foodTypes = [
  { value: "Foundation", label: "Foundation" },
  { value: "SR Legacy", label: "SR Legacy" },
  { value: "Survey (FNDDS)", label: "Survey (FNDDS)" },
  { value: "Branded", label: "Branded" },
] as const;

export type FoodType = (typeof foodTypes)[number]["value"];
export const defaultFoodTypes: FoodType[] = foodTypes.map(({ value }) => value);

export function isFoodTypeSelection(value: unknown): value is FoodType[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "string" && foodTypes.some((type) => type.value === item)) &&
    new Set(value).size === value.length;
}

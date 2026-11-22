import "server-only";

import type { FoodSearchResults, SearchNutrient } from "@/lib/food-search";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseFoodSearch(value: unknown): FoodSearchResults {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.totalHits) ||
    !isNonNegativeInteger(value.currentPage) ||
    !isNonNegativeInteger(value.totalPages) ||
    !Array.isArray(value.foods)
  ) {
    throw new Error("Invalid USDA search response.");
  }

  const foods = value.foods.map((food) => {
    if (
      !isRecord(food) ||
      !isNonNegativeInteger(food.fdcId) ||
      food.fdcId === 0 ||
      typeof food.description !== "string" ||
      (food.foodNutrients != null && !Array.isArray(food.foodNutrients))
    ) {
      throw new Error("Invalid USDA food search result.");
    }

    const nutrients: SearchNutrient[] = [];
    for (const nutrient of food.foodNutrients ?? []) {
      if (!isRecord(nutrient)) throw new Error("Invalid USDA nutrient.");
      if (nutrient.value == null) continue;
      if (
        !isNonNegativeInteger(nutrient.nutrientId) ||
        typeof nutrient.nutrientName !== "string" ||
        typeof nutrient.unitName !== "string" ||
        typeof nutrient.value !== "number" ||
        !Number.isFinite(nutrient.value) ||
        nutrient.value < 0
      ) {
        throw new Error("Invalid USDA nutrient.");
      }
      nutrients.push({
        id: nutrient.nutrientId,
        name: nutrient.nutrientName,
        unit: nutrient.unitName,
        value: nutrient.value,
        derivation: typeof nutrient.derivationDescription === "string" ? nutrient.derivationDescription : null,
      });
    }
    return {
      fdcId: food.fdcId,
      description: food.description,
      dataType: typeof food.dataType === "string" ? food.dataType : null,
      brand: typeof food.brandName === "string"
        ? food.brandName
        : typeof food.brandOwner === "string" ? food.brandOwner : null,
      nutrients,
    };
  });

  return {
    totalHits: value.totalHits,
    currentPage: value.currentPage,
    totalPages: value.totalPages,
    foods,
  };
}

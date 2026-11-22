export type SearchNutrient = {
  id: number;
  name: string;
  unit: string;
  value: number;
  derivation: string | null;
};

export type SearchFood = {
  fdcId: number;
  description: string;
  dataType: string | null;
  brand: string | null;
  nutrients: SearchNutrient[];
};

export type FoodSearchResults = {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: SearchFood[];
};

export type PlannedMeal = {
  id: string;
  name: string;
};

export type MealPlan = {
  id: string;
  name: string;
  meals: PlannedMeal[];
};

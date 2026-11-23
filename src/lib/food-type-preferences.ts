import "server-only";

import { db } from "@/lib/db";
import { defaultFoodTypes, isFoodTypeSelection, type FoodType } from "@/lib/food-types";

export async function getFoodTypePreferences(userId: string): Promise<FoodType[]> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { foodTypePreferences: true } });
  if (user.foodTypePreferences === null) return defaultFoodTypes;
  const value: unknown = JSON.parse(user.foodTypePreferences);
  if (!isFoodTypeSelection(value)) throw new Error("Invalid stored food type preferences.");
  return value;
}

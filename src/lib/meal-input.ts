import "server-only";

import type { Prisma } from "@prisma/client";
import { isRecord, mealNameKey, validName } from "@/lib/meal-plan-api";

type EntryInput = {
  foodId: string;
  quantity: number;
  unitLabel: string;
  basisPerUnit: number;
  basis: "g" | "ml" | "unit";
};

export function parseMealInput(body: unknown): { name: string; nameKey: string; entries: EntryInput[] } | string {
  if (!isRecord(body) || !validName(body.name)) return "Enter a meal name of 1 to 100 characters.";
  if (!Array.isArray(body.entries) || body.entries.length > 100) return "A meal can contain up to 100 food entries.";
  const entries: EntryInput[] = [];
  for (const entry of body.entries) {
    if (
      !isRecord(entry) || typeof entry.foodId !== "string" || entry.foodId.length < 1 || entry.foodId.length > 128 ||
      !validName(entry.unitLabel) || (entry.basis !== "g" && entry.basis !== "ml" && entry.basis !== "unit") ||
      typeof entry.quantity !== "number" || !Number.isFinite(entry.quantity) || entry.quantity <= 0 ||
      typeof entry.basisPerUnit !== "number" || !Number.isFinite(entry.basisPerUnit) || entry.basisPerUnit <= 0 ||
      entry.quantity * entry.basisPerUnit > 100000000
    ) return "Enter a valid positive amount and unit conversion for each food.";
    entries.push({
      foodId: entry.foodId,
      quantity: entry.quantity,
      unitLabel: entry.unitLabel.trim(),
      basisPerUnit: entry.basisPerUnit,
      basis: entry.basis,
    });
  }

  const name = body.name.trim();
  return { name, nameKey: mealNameKey(name), entries };
}

export async function entriesAreAccessible(tx: Prisma.TransactionClient, userId: string, entries: EntryInput[]) {
  const foodIds = [...new Set(entries.map((entry) => entry.foodId))];
  const foods = await tx.food.findMany({
    where: { id: { in: foodIds }, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, nutrientBasis: true },
  });
  return foods.length === foodIds.length && entries.every((entry) => {
    const food = foods.find((item) => item.id === entry.foodId);
    return food && (food.nutrientBasis === entry.basis || (food.nutrientBasis === "unknown" && entry.basis !== "unit"));
  });
}

export async function mealNameExists(tx: Prisma.TransactionClient, userId: string, nameKey: string, exceptId?: string) {
  const meals = await tx.meal.findMany({
    where: { userId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  return meals.some((meal) => mealNameKey(meal.name) === nameKey);
}

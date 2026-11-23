import "server-only";

import type { Prisma } from "@prisma/client";
import { isRecord, validName } from "@/lib/meal-plan-api";

export function parsePlanInput(body: unknown): { name: string; mealIds: string[] } | string {
  if (!isRecord(body) || !validName(body.name)) return "Enter a plan name of 1 to 100 characters.";
  if (!Array.isArray(body.mealIds) || body.mealIds.length < 1 || body.mealIds.length > 100 ||
      !body.mealIds.every((id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 128) ||
      new Set(body.mealIds).size !== body.mealIds.length) {
    return "Choose between 1 and 100 different meals.";
  }
  return { name: body.name.trim(), mealIds: body.mealIds };
}

export async function mealsAreAccessible(tx: Prisma.TransactionClient, userId: string, ids: string[]) {
  return await tx.meal.count({ where: { userId, id: { in: ids } } }) === ids.length;
}

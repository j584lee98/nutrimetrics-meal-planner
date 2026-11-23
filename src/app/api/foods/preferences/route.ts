import { db } from "@/lib/db";
import { getFoodTypePreferences } from "@/lib/food-type-preferences";
import { isFoodTypeSelection } from "@/lib/food-types";
import { apiError, checkMutationOrigin, getUserId, isRecord, readJson } from "@/lib/meal-plan-api";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to view food filters.", 401);
  const types = await getFoodTypePreferences(userId);
  return Response.json({ types }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to save food filters.", 401);
  const input = await readJson(request);
  if (!isRecord(input) || !isFoodTypeSelection(input.types)) return apiError("Invalid food type selection.", 400);
  await db.user.update({ where: { id: userId }, data: { foodTypePreferences: JSON.stringify(input.types) } });
  return Response.json({ types: input.types }, { headers: { "Cache-Control": "no-store" } });
}

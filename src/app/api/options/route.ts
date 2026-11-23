import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, isRecord, readJson } from "@/lib/meal-plan-api";
import { nutrientCatalog } from "@/lib/nutrient-preferences";

export async function PUT(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to save options.", 401);
  const input = await readJson(request);
  if (!isRecord(input) || !Array.isArray(input.nutrientIds) ||
      input.nutrientIds.length > 500 ||
      input.nutrientIds.some((id: unknown) => !Number.isSafeInteger(id) || (typeof id === "number" && id <= 0)) ||
      new Set(input.nutrientIds).size !== input.nutrientIds.length) {
    return apiError("Invalid nutrient selection.", 400);
  }
  const catalog = new Map(nutrientCatalog.map((nutrient) => [nutrient.id, nutrient]));
  const columns = input.nutrientIds.map((id: number) => catalog.get(id));
  if (columns.some((column) => !column)) return apiError("A selected nutrient is unavailable.", 400);
  await db.user.update({ where: { id: userId }, data: { nutrientPreferences: JSON.stringify(columns) } });
  return Response.json({ nutrients: columns }, { headers: { "Cache-Control": "no-store" } });
}

import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, readJson } from "@/lib/meal-plan-api";
import { mealsAreAccessible, parsePlanInput } from "@/lib/plan-input";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to edit a meal plan.", 401);
  const input = parsePlanInput(await readJson(request));
  if (typeof input === "string") return apiError(input, 400);
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    if (!(await tx.mealPlan.findFirst({ where: { id, userId }, select: { id: true } }))) return "not-found";
    if (!(await mealsAreAccessible(tx, userId, input.mealIds))) return "invalid-meal";
    await tx.mealPlan.update({ where: { id }, data: { name: input.name } });
    await tx.mealPlanMeal.deleteMany({ where: { mealPlanId: id } });
    await tx.mealPlanMeal.createMany({ data: input.mealIds.map((mealId, position) => ({ mealPlanId: id, mealId, userId, position })) });
    return "saved";
  });
  if (result === "not-found") return apiError("Meal plan not found.", 404);
  if (result === "invalid-meal") return apiError("A selected meal is unavailable.", 400);
  return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to delete a meal plan.", 401);

  const { id } = await params;
  const result = await db.mealPlan.deleteMany({ where: { id, userId } });
  if (!result.count) return apiError("Meal plan not found.", 404);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId } from "@/lib/meal-plan-api";

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

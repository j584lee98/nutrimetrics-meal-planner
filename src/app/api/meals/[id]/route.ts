import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId } from "@/lib/meal-plan-api";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to delete a meal.", 401);

  const { id } = await params;
  const result = await db.meal.deleteMany({ where: { id, mealPlan: { userId } } });
  if (!result.count) return apiError("Meal not found.", 404);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

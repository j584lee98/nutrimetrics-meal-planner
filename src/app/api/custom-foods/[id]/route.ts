import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId } from "@/lib/meal-plan-api";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to delete custom foods.", 401);
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    const food = await tx.food.findFirst({ where: { id, ownerId: userId }, select: { _count: { select: { mealEntries: true } } } });
    if (!food) return "not-found";
    if (food._count.mealEntries) return "in-use";
    await tx.food.delete({ where: { id } });
    return "deleted";
  });
  if (result === "not-found") return apiError("Custom food not found.", 404);
  if (result === "in-use") return apiError("Remove this food from all meals before deleting it.", 409);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

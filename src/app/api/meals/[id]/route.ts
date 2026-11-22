import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiError, checkMutationOrigin, getUserId, readJson } from "@/lib/meal-plan-api";
import { entriesAreAccessible, mealNameExists, parseMealInput } from "@/lib/meal-input";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to edit a meal.", 401);
  const input = parseMealInput(await readJson(request));
  if (typeof input === "string") return apiError(input, 400);
  const { id } = await params;
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.meal.findFirst({ where: { id, userId }, select: { id: true } });
      if (!existing) return "not-found";
      if (await mealNameExists(tx, userId, input.nameKey, id)) return "duplicate-name";
      if (!(await entriesAreAccessible(tx, userId, input.entries))) return "invalid-food";
      await tx.meal.update({ where: { id, userId }, data: { name: input.name, nameKey: input.nameKey } });
      await tx.mealEntry.deleteMany({ where: { mealId: id } });
      if (input.entries.length) await tx.mealEntry.createMany({
        data: input.entries.map((entry, position) => ({ ...entry, mealId: id, position })),
      });
      return "saved";
    });
    if (result === "not-found") return apiError("Meal not found.", 404);
    if (result === "duplicate-name") return apiError("A meal with that name already exists.", 409);
    if (result === "invalid-food") return apiError("A food or its nutrient basis is unavailable.", 400);
    return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("A meal with that name already exists.", 409);
    }
    throw error;
  }
}

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

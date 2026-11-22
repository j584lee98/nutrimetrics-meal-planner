import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, readJson } from "@/lib/meal-plan-api";
import { entriesAreAccessible, mealNameExists, parseMealInput } from "@/lib/meal-input";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to add a meal.", 401);

  const mealInput = parseMealInput(await readJson(request));
  if (typeof mealInput === "string") return apiError(mealInput, 400);
  const { id } = await params;
  try {
    const meal = await db.$transaction(async (tx) => {
      const plan = await tx.mealPlan.findFirst({ where: { id, userId }, select: { id: true } });
      if (!plan) return null;
      if (await mealNameExists(tx, userId, mealInput.nameKey)) return "duplicate-name";
      if (!(await entriesAreAccessible(tx, userId, mealInput.entries))) return "invalid-food";
      const created = await tx.meal.create({
        data: { name: mealInput.name, nameKey: mealInput.nameKey, userId, mealPlanId: id },
        select: { id: true, name: true },
      });
      if (mealInput.entries.length) {
        await tx.mealEntry.createMany({
          data: mealInput.entries.map((entry, position) => ({ ...entry, mealId: created.id, position })),
        });
      }
      return created;
    });
    if (meal === null) return apiError("Meal plan not found.", 404);
    if (meal === "duplicate-name") return apiError("A meal with that name already exists.", 409);
    if (meal === "invalid-food") return apiError("A food or its nutrient basis is unavailable.", 400);
    return Response.json(meal, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("A meal with that name already exists.", 409);
    }
    throw error;
  }
}

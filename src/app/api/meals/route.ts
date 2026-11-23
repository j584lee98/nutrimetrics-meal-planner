import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, readJson } from "@/lib/meal-plan-api";
import { entriesAreAccessible, mealNameExists, parseMealInput } from "@/lib/meal-input";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to view meals.", 401);
  const meals = await db.meal.findMany({
    where: { userId },
    select: { id: true, name: true, _count: { select: { plans: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return Response.json(meals.map(({ _count, ...meal }) => ({ ...meal, planCount: _count.plans })), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to create a meal.", 401);
  const input = parseMealInput(await readJson(request));
  if (typeof input === "string") return apiError(input, 400);
  try {
    const result = await db.$transaction(async (tx) => {
      if (await mealNameExists(tx, userId, input.nameKey)) return "duplicate-name";
      if (!(await entriesAreAccessible(tx, userId, input.entries))) return "invalid-food";
      return tx.meal.create({
        data: {
          name: input.name, nameKey: input.nameKey, userId,
          entries: { create: input.entries.map((entry, position) => ({ ...entry, position })) },
        },
        select: { id: true, name: true },
      });
    });
    if (result === "duplicate-name") return apiError("A meal with that name already exists.", 409);
    if (result === "invalid-food") return apiError("A food or its nutrient basis is unavailable.", 400);
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("A meal with that name already exists.", 409);
    }
    throw error;
  }
}

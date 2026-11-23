import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, readJson } from "@/lib/meal-plan-api";
import { mealsAreAccessible, parsePlanInput } from "@/lib/plan-input";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to view meal plans.", 401);

  const plans = await db.mealPlan.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      meals: {
        select: { meal: { select: { id: true, name: true } } },
        orderBy: [{ position: "asc" }, { mealId: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return Response.json(plans.map((plan) => ({ ...plan, meals: plan.meals.map(({ meal }) => meal) })), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to create a meal plan.", 401);

  const input = parsePlanInput(await readJson(request));
  if (typeof input === "string") return apiError(input, 400);
  const plan = await db.$transaction(async (tx) => {
    if (!(await mealsAreAccessible(tx, userId, input.mealIds))) return null;
    const created = await tx.mealPlan.create({
      data: { userId, name: input.name },
      select: { id: true, name: true },
    });
    await tx.mealPlanMeal.createMany({ data: input.mealIds.map((mealId, position) => ({ mealPlanId: created.id, mealId, userId, position })) });
    return created;
  });
  if (!plan) return apiError("A selected meal is unavailable.", 400);
  return Response.json(plan, { status: 201, headers: { "Cache-Control": "no-store" } });
}

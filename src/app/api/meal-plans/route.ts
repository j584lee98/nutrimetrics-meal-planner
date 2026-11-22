import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, isRecord, readJson, validName } from "@/lib/meal-plan-api";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to view meal plans.", 401);

  const plans = await db.mealPlan.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      meals: {
        select: { id: true, name: true, date: true },
        orderBy: [{ date: "asc" }, { name: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return Response.json(plans, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to create a meal plan.", 401);

  const body = await readJson(request);
  if (!isRecord(body) || !validName(body.name)) return apiError("Enter a plan name of 1 to 100 characters.", 400);
  const plan = await db.mealPlan.create({
    data: { userId, name: body.name.trim() },
    select: { id: true, name: true },
  });
  return Response.json(plan, { status: 201, headers: { "Cache-Control": "no-store" } });
}

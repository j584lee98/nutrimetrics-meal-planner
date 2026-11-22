import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, isRecord, readJson, validDate, validName } from "@/lib/meal-plan-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to add a meal.", 401);

  const body = await readJson(request);
  if (!isRecord(body) || !validName(body.name)) return apiError("Enter a meal name of 1 to 100 characters.", 400);
  if (!validDate(body.date)) return apiError("Enter a valid meal date.", 400);
  const { id } = await params;
  try {
    const meal = await db.meal.create({
      data: { name: body.name.trim(), date: body.date, mealPlan: { connect: { id, userId } } },
      select: { id: true, name: true, date: true },
    });
    return Response.json(meal, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return apiError("Meal plan not found.", 404);
    }
    throw error;
  }
}

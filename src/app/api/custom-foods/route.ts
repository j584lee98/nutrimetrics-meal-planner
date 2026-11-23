import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, isRecord, readJson, validName } from "@/lib/meal-plan-api";
import { foodInclude, toBuilderFood } from "@/lib/builder-food";
import { nutrientCatalog } from "@/lib/nutrient-preferences";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to search custom foods.", 401);
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 100) return apiError("Enter a search term of 1 to 100 characters.", 400);
  const foods = await db.food.findMany({
    where: { ownerId: userId, AND: query.split(/\s+/).map((word) => ({ name: { contains: word } })) },
    include: foodInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
  });
  return Response.json({ foods: foods.map(toBuilderFood) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to create custom foods.", 401);
  const body = await readJson(request);
  if (!isRecord(body) || !validName(body.name) || !validName(body.unit) ||
      typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0.000001 || body.amount > 100000000 ||
      !Array.isArray(body.nutrients) || body.nutrients.length > nutrientCatalog.length) {
    return apiError("Enter a valid name, unit, amount, and nutrients.", 400);
  }
  const amount = body.amount;
  const name = body.name.trim();
  const unit = body.unit.trim();
  const normalizedUnit = unit.toLowerCase();
  const basis = normalizedUnit === "g" || normalizedUnit === "ml" ? normalizedUnit : "unit";
  const defaultUnit = basis === "unit" ? unit : basis;
  const catalog = new Map(nutrientCatalog.map((nutrient) => [nutrient.id, nutrient]));
  const seen = new Set<number>();
  const nutrients: { id: number; name: string; unit: string; value: number }[] = [];
  for (const item of body.nutrients) {
    if (!isRecord(item) || typeof item.id !== "number" || !Number.isSafeInteger(item.id) ||
        typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0 || item.value > 100000000 ||
        seen.has(item.id)) return apiError("Enter valid non-negative nutrient values.", 400);
    const nutrient = catalog.get(item.id);
    const per100 = item.value * 100 / amount;
    if (!nutrient || !Number.isFinite(per100) || per100 > 100000000) return apiError("Nutrient value is out of range.", 400);
    seen.add(item.id);
    nutrients.push({ ...nutrient, unit: nutrient.unit === "µg" ? "UG" : nutrient.unit.toUpperCase(), value: per100 });
  }
  const food = await db.$transaction(async (tx) => {
    for (const nutrient of nutrients) {
      const stored = await tx.nutrient.upsert({
        where: { id: nutrient.id },
        create: { id: nutrient.id, name: nutrient.name, unit: nutrient.unit },
        update: {},
      });
      if (stored.unit.toLowerCase().replace(/[µμ]/g, "u") !== nutrient.unit.toLowerCase()) {
        throw new Error(`Inconsistent unit for nutrient ${nutrient.id}.`);
      }
    }
    return tx.food.create({
      data: {
        name, ownerId: userId, nutrientBasis: basis,
        defaultAmount: amount, defaultUnit,
        nutrients: { create: nutrients.map((nutrient) => ({ nutrientId: nutrient.id, per100Unit: nutrient.value })) },
      },
      include: foodInclude,
    });
  });
  return Response.json(toBuilderFood(food), { status: 201, headers: { "Cache-Control": "no-store" } });
}

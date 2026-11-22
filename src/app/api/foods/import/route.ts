import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, checkMutationOrigin, getUserId, isRecord, readJson } from "@/lib/meal-plan-api";
import { foodInclude, toBuilderFood } from "@/lib/builder-food";
import type { BuilderFood, NutrientBasis } from "@/lib/meal-builder";

function parseDetails(data: unknown, fdcId: number) {
  if (!isRecord(data) || data.fdcId !== fdcId || typeof data.description !== "string" || !Array.isArray(data.foodNutrients)) {
    throw new Error("Invalid USDA food details.");
  }
  const servingUnit = typeof data.servingSizeUnit === "string" ? data.servingSizeUnit.toLowerCase() : "";
  const basis: NutrientBasis = data.dataType === "Branded"
    ? servingUnit === "g" || servingUnit === "ml" ? servingUnit : "unknown"
    : ["Foundation", "SR Legacy", "Survey (FNDDS)"].includes(String(data.dataType)) ? "g" : "unknown";
  const portions: BuilderFood["portions"] = [];
  if ((servingUnit === "g" || servingUnit === "ml") && typeof data.servingSize === "number" && Number.isFinite(data.servingSize) && data.servingSize > 0) {
    portions.push({ label: `1 serving (${data.servingSize} ${servingUnit})`, basis: servingUnit, amount: data.servingSize });
  }
  if (Array.isArray(data.foodPortions)) {
    for (const portion of data.foodPortions) {
      if (!isRecord(portion) || typeof portion.gramWeight !== "number" || !Number.isFinite(portion.gramWeight) || portion.gramWeight <= 0) continue;
      const measure = isRecord(portion.measureUnit) && typeof portion.measureUnit.name === "string" ? portion.measureUnit.name : "";
      const label = typeof portion.portionDescription === "string" && portion.portionDescription.trim()
        ? portion.portionDescription.trim()
        : measure && measure !== "undetermined"
          ? `${typeof portion.amount === "number" ? portion.amount : 1} ${measure}${typeof portion.modifier === "string" ? `, ${portion.modifier}` : ""}`
          : "";
      if (label) portions.push({ label: `${label} (${portion.gramWeight} g)`, basis: "g", amount: portion.gramWeight });
    }
  }

  const nutrients: BuilderFood["nutrients"] = [];
  const seen = new Set<number>();
  for (const item of data.foodNutrients) {
    if (!isRecord(item) || !isRecord(item.nutrient)) throw new Error("Invalid USDA nutrient.");
    if (item.amount == null) continue;
    const nutrient = item.nutrient;
    if (
      typeof nutrient.id !== "number" || !Number.isSafeInteger(nutrient.id) || nutrient.id <= 0 ||
      typeof nutrient.name !== "string" || typeof nutrient.unitName !== "string" ||
      typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount < 0 ||
      seen.has(nutrient.id)
    ) throw new Error("Invalid USDA nutrient.");
    seen.add(nutrient.id);
    nutrients.push({
      id: nutrient.id,
      name: nutrient.name,
      unit: nutrient.unitName,
      value: item.amount,
      derivation: isRecord(item.foodNutrientDerivation) && typeof item.foodNutrientDerivation.description === "string"
        ? item.foodNutrientDerivation.description : null,
    });
  }
  return { name: data.description, basis, portions, nutrients };
}

export async function POST(request: Request) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;
  const userId = await getUserId(request);
  if (!userId) return apiError("Sign in to add foods.", 401);
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.fdcId !== "number" || !Number.isSafeInteger(body.fdcId) || body.fdcId <= 0) {
    return apiError("Invalid food ID.", 400);
  }
  const fdcId = body.fdcId;
  const existing = await db.food.findUnique({ where: { fdcId }, include: foodInclude });
  if (existing?.ownerId) return apiError("USDA food is unavailable.", 409);
  if (existing) return Response.json(toBuilderFood(existing), { headers: { "Cache-Control": "no-store" } });

  const key = process.env.USDA_API_KEY?.trim();
  if (!key) {
    console.error("USDA_API_KEY is not configured.");
    return apiError("Food search is not configured. Set USDA_API_KEY on the server.", 503);
  }
  let response: Response;
  try {
    response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}`, {
      headers: { "X-Api-Key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(timedOut ? "USDA food details timed out." : "USDA food details request failed.");
    return apiError(timedOut ? "USDA food details timed out. Please try again." : "Could not reach USDA. Please try again.", timedOut ? 504 : 502);
  }
  if (!response.ok) {
    console.error(`USDA food details returned HTTP ${response.status}.`);
    if (response.status === 404) return apiError("USDA food not found.", 404);
    if (response.status === 429) return apiError("USDA's request limit has been reached. Please try again later.", 429);
    return apiError("USDA food details are unavailable. Check your API key and try again.", 502);
  }
  let details: ReturnType<typeof parseDetails>;
  try {
    details = parseDetails(await response.json(), fdcId);
  } catch {
    console.error("USDA returned invalid food details.");
    return apiError("USDA returned unexpected food details.", 502);
  }

  try {
    const food = await db.$transaction(async (tx) => {
      const found = await tx.food.findUnique({ where: { fdcId }, include: foodInclude });
      if (found?.ownerId) throw new Error("USDA food ID conflicts with a private food.");
      if (found) return found;
      for (const nutrient of details.nutrients) {
        const stored = await tx.nutrient.upsert({
          where: { id: nutrient.id },
          create: { id: nutrient.id, name: nutrient.name, unit: nutrient.unit },
          update: {},
        });
        if (stored.unit.toLowerCase() !== nutrient.unit.toLowerCase()) {
          throw new Error(`Inconsistent unit for USDA nutrient ${nutrient.id}.`);
        }
      }
      return tx.food.create({
        data: {
          fdcId,
          name: details.name,
          nutrientBasis: details.basis,
          portionsJson: JSON.stringify(details.portions),
          nutrients: { create: details.nutrients.map((nutrient) => ({
            nutrientId: nutrient.id, per100Unit: nutrient.value, derivation: nutrient.derivation,
          })) },
        },
        include: foodInclude,
      });
    });
    return Response.json(toBuilderFood(food), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const food = await db.food.findUnique({ where: { fdcId }, include: foodInclude });
      if (food && !food.ownerId) return Response.json(toBuilderFood(food), { headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
}

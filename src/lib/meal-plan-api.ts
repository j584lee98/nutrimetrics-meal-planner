import "server-only";

import { auth } from "@/lib/auth";

export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function getUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export function checkMutationOrigin(request: Request): Response | null {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    console.error("BETTER_AUTH_URL is required for meal plan changes.");
    return apiError("Meal planning is not configured on the server.", 503);
  }
  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(baseUrl).origin;
  } catch {
    console.error("BETTER_AUTH_URL is not a valid URL.");
    return apiError("Meal planning is not configured on the server.", 503);
  }
  if (request.headers.get("origin") !== allowedOrigin) {
    return apiError("Request origin is not allowed.", 403);
  }
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 100;
}

export function mealNameKey(name: string) {
  return name.trim().normalize("NFKC").toLowerCase();
}

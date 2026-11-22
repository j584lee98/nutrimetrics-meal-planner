import { auth } from "@/lib/auth";
import { parseFoodSearch } from "@/lib/usda";

const PAGE_SIZE = 20;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return error("Sign in to search foods.", 401);

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const pageText = params.get("page") ?? "1";
  if (!query || query.length > 100) return error("Enter a search term of 1 to 100 characters.", 400);
  if (!/^[1-9]\d{0,3}$/.test(pageText)) return error("Invalid page number.", 400);
  const page = Number(pageText);
  const searchQuery = params.get("all") === "1"
    ? query.split(/\s+/).map((word) => `+${word.replace(/[+\-!(){}\[\]^"~*?:\\/|&]/g, "\\$&")}`).join(" ")
    : query;

  const key = process.env.USDA_API_KEY?.trim();
  if (!key) {
    console.error("USDA_API_KEY is not configured.");
    return error("Food search is not configured. Set USDA_API_KEY on the server.", 503);
  }

  let response: Response;
  try {
    response = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ query: searchQuery, pageSize: PAGE_SIZE, pageNumber: page }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    console.error(timedOut ? "USDA food search timed out." : "USDA food search network request failed.");
    return error(timedOut ? "USDA food search timed out. Please try again." : "Could not reach USDA food search. Please try again.", timedOut ? 504 : 502);
  }

  if (!response.ok) {
    console.error(`USDA food search returned HTTP ${response.status}.`);
    if (response.status === 429) return error("USDA's search limit has been reached. Please try again later.", 429);
    if (response.status === 401 || response.status === 403) return error("USDA rejected the API key. Check the server configuration.", 502);
    return error("USDA food search is unavailable. Please try again.", 502);
  }

  try {
    const result = parseFoodSearch(await response.json());
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("USDA returned an invalid food search response.");
    return error("USDA returned an unexpected response. Please try again later.", 502);
  }
}

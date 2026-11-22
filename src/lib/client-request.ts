export async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    if (response.headers.get("content-type")?.includes("application/json")) {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== "https://api.nal.usda.gov") {
    return originalFetch(input, init);
  }
  if (new Headers(init.headers).get("X-Api-Key") !== "test-usda-key" || url.searchParams.has("api_key")) {
    return new Response("Unexpected API key", { status: 403 });
  }
  if (url.pathname.startsWith("/fdc/v1/food/")) {
    const id = Number(url.pathname.split("/").pop());
    if (![123, 456, 789].includes(id)) return new Response("", { status: 404 });
    return Response.json({
      fdcId: id,
      description: id === 123 ? "Test apple" : id === 456 ? "Test drink" : "Unknown basis",
      dataType: id === 123 ? "Foundation" : "Branded",
      ...(id === 456 ? { servingSize: 250, servingSizeUnit: "ml" } : {}),
      foodPortions: id === 123 ? [{ amount: 1, measureUnit: { name: "apple" }, gramWeight: 150 }] : [],
      foodNutrients: [
        { nutrient: { id: 1003, name: "Protein", unitName: "G" }, amount: id === 123 ? 2 : 1 },
        ...(id === 123 ? [{ nutrient: { id: 1004, name: "Fat", unitName: "G" }, amount: 0,
          foodNutrientDerivation: { description: "Calculated from a less than value" } },
          { nutrient: { id: 1087, name: "Calcium", unitName: "MG" }, amount: 10 },
          { nutrient: { id: 1079, name: "Fiber, total dietary", unitName: "G" }, amount: 2 },
          { nutrient: { id: 1258, name: "Fatty acids, total saturated", unitName: "G" }, amount: 0.5 },
          { nutrient: { id: 1109, name: "Vitamin E (alpha-tocopherol)", unitName: "MG" }, amount: 0.18 },
          { nutrient: { id: 1242, name: "Vitamin E, added", unitName: "MG" }, amount: 9 },
          { nutrient: { id: 1106, name: "Vitamin A, RAE", unitName: "UG" }, amount: 3 },
          { nutrient: { id: 1227, name: "Serine", unitName: "G" }, amount: 1 }] : []),
        ...(id === 456 ? [{ nutrient: { id: 1104, name: "Vitamin A, IU", unitName: "IU" }, amount: 206 }] : []),
      ],
    });
  }
  if (url.pathname !== "/fdc/v1/foods/search") return new Response("", { status: 404 });
  const request = JSON.parse(init.body);
  if (request.query.startsWith("+") && request.query !== "+red +apple") {
    return Response.json({ totalHits: 0, currentPage: 1, totalPages: 0, foods: [] });
  }
  if (request.query === "rate limit") return new Response("", { status: 429 });
  if (request.query === "bad response") return Response.json({ foods: "invalid" });
  if (request.query === "no results") {
    return Response.json({ totalHits: 0, currentPage: 1, totalPages: 0, foods: [] });
  }
  return Response.json({
    totalHits: 21,
    currentPage: request.pageNumber,
    totalPages: 2,
    foods: [{
      fdcId: request.pageNumber === 1 ? 123 : 456,
      description: request.pageNumber === 1 ? "Test apple" : "Test pear",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientId: 1003, nutrientName: "Protein", unitName: "G", value: 0.26 },
        { nutrientId: 1004, nutrientName: "Fat", unitName: "G", value: 0, derivationDescription: "Calculated from a less than value per serving size measure" },
        { nutrientId: 1005, nutrientName: "Unavailable", unitName: "G" },
      ],
    }],
  });
};

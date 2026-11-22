"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { isBuilderFood, type BuilderFood } from "@/lib/meal-builder";

type Suggestion = { fdcId: number; description: string; dataType: string | null; brand: string | null };

export function FoodPicker({ onAdd }: { onAdd: (food: BuilderFood) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: term, all: "1" });
        const data = await requestJson(`/api/foods/search?${params}`, { signal: controller.signal });
        if (typeof data !== "object" || data === null || !("foods" in data) || !Array.isArray(data.foods) ||
          !data.foods.every((food: unknown) => typeof food === "object" && food !== null &&
            "fdcId" in food && typeof food.fdcId === "number" && Number.isSafeInteger(food.fdcId) && food.fdcId > 0 &&
            "description" in food && typeof food.description === "string" &&
            "dataType" in food && (typeof food.dataType === "string" || food.dataType === null) &&
            "brand" in food && (typeof food.brand === "string" || food.brand === null))) {
          throw new Error("Invalid food search response.");
        }
        if (!controller.signal.aborted) {
          setSuggestions(data.foods);
          setSearched(term);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Food search failed", cause);
        setSuggestions([]);
        setError(cause instanceof Error ? cause.message : "Could not search foods.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function add(fdcId: number) {
    setAdding(true);
    setError("");
    try {
      const food = await requestJson("/api/foods/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fdcId }),
      });
      if (!isBuilderFood(food)) {
        throw new Error("Invalid food response.");
      }
      onAdd(food);
      setQuery("");
      setSuggestions([]);
    } catch (cause) {
      console.error("Could not add food", cause);
      setError(cause instanceof Error ? cause.message : "Could not add food.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="food-picker">
      <label htmlFor="builder-food-search">Add a USDA food</label>
      <input id="builder-food-search" type="search" value={query} disabled={adding} onChange={(event) => {
        setQuery(event.target.value);
        setSuggestions([]);
        setError("");
        setLoading(false);
      }} placeholder="Search with one or more words" maxLength={100} autoComplete="off" />
      {query.trim() && (
        <div className="food-suggestions" aria-live="polite">
          {(loading || (!error && searched !== query.trim())) && <p>Searching USDA...</p>}
          {!loading && !error && searched === query.trim() && suggestions.length === 0 && <p>No foods found.</p>}
          {suggestions.map((food) => (
            <button type="button" key={food.fdcId} disabled={adding} onClick={() => void add(food.fdcId)}>
              <strong>{food.description}</strong>
              <span>{[food.dataType, food.brand].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {adding && <p className="field-hint" role="status">Adding food...</p>}
    </div>
  );
}

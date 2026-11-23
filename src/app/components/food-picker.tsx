"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { isBuilderFood, type BuilderFood } from "@/lib/meal-builder";
import type { FoodType } from "@/lib/food-types";
import { FoodTypeFilter, useFoodTypeFilter } from "@/app/components/food-type-filter";

type Suggestion = { fdcId: number; description: string; dataType: string | null; brand: string | null };

export function FoodPicker({ onAdd, initialFoodTypes, label = "Add a food" }: { onAdd: (food: BuilderFood) => void; initialFoodTypes: FoodType[]; label?: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [customFoods, setCustomFoods] = useState<BuilderFood[]>([]);
  const [customError, setCustomError] = useState("");
  const [customSearched, setCustomSearched] = useState("");
  const filter = useFoodTypeFilter(initialFoodTypes);
  const searchKey = `${query.trim()}\n${filter.types.join("|")}`;

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await requestJson(`/api/custom-foods?${new URLSearchParams({ q: term })}`, { signal: controller.signal });
        if (typeof data !== "object" || data === null || !("foods" in data) || !Array.isArray(data.foods) || !data.foods.every(isBuilderFood)) {
          throw new Error("Invalid custom food search response.");
        }
        if (!controller.signal.aborted) {
          setCustomFoods(data.foods);
          setCustomSearched(term);
          setCustomError("");
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Custom food search failed", cause);
        setCustomFoods([]);
        setCustomError(cause instanceof Error ? cause.message : "Could not search custom foods.");
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

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
          setSearched(searchKey);
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
  }, [query, searchKey]);

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
      <label htmlFor="builder-food-search">{label}</label>
      <div className="food-search-input">
        <input id="builder-food-search" type="search" value={query} disabled={adding} onChange={(event) => {
          setQuery(event.target.value);
          setSuggestions([]);
          setCustomFoods([]);
          setCustomError("");
          setError("");
          setLoading(false);
        }} placeholder="Search with one or more words" maxLength={100} autoComplete="off" />
        <FoodTypeFilter filter={filter} />
      </div>
      {filter.error && <p className="form-error" role="alert">{filter.error}</p>}
      {query.trim() && (
        <div className="food-suggestions" aria-live="polite">
          {customSearched === query.trim() && customFoods.map((food) => (
            <button type="button" key={food.id} disabled={adding} onClick={() => {
              onAdd(food);
              setQuery("");
              setSuggestions([]);
              setCustomFoods([]);
            }}>
              <strong>{food.name}</strong><span>Custom food</span>
            </button>
          ))}
          {(filter.saving || loading || (!error && searched !== searchKey)) && <p>Searching USDA...</p>}
          {!filter.saving && !loading && !error && searched === searchKey && suggestions.length === 0 && <p>{filter.types.length ? "No USDA foods found." : "Select a food type to search USDA."}</p>}
          {!filter.saving && searched === searchKey && suggestions.map((food) => (
            <button type="button" key={food.fdcId} disabled={adding} onClick={() => void add(food.fdcId)}>
              <strong>{food.description}</strong>
              <span>{[food.dataType, food.brand].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {customError && <p className="form-error" role="alert">{customError}</p>}
      {adding && <p className="field-hint" role="status">Adding food...</p>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { isBuilderFood, type BuilderFood } from "@/lib/meal-builder";
import type { FoodType } from "@/lib/food-types";
import { FoodTypeFilter, useFoodTypeFilter } from "@/app/components/food-type-filter";

type Suggestion = { fdcId: number; description: string; dataType: string | null; brand: string | null };
type SearchPage = { key: string; page: number; totalPages: number; foods: Suggestion[] };

export function FoodPicker({ onAdd, initialFoodTypes, label = "Add a food" }: { onAdd: (food: BuilderFood) => void; initialFoodTypes: FoodType[]; label?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPage | null>(null);
  const [requestedPage, setRequestedPage] = useState({ key: "", page: 1 });
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [customFoods, setCustomFoods] = useState<BuilderFood[]>([]);
  const [customError, setCustomError] = useState("");
  const [customSearched, setCustomSearched] = useState("");
  const filter = useFoodTypeFilter(initialFoodTypes);
  const searchKey = `${query.trim()}\n${filter.types.join("|")}`;
  const previousKey = useRef(searchKey);
  const page = requestedPage.key === searchKey ? requestedPage.page : 1;
  const visibleResults = results?.key === searchKey ? results : null;

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
    if (previousKey.current !== searchKey) {
      previousKey.current = searchKey;
      setRequestedPage({ key: searchKey, page: 1 });
      setResults(null);
      setSearchError("");
      setLoading(false);
      return;
    }
    const term = query.trim();
    if (!term || filter.saving) return;
    const controller = new AbortController();
    setLoading(true);
    setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, page: String(page) });
        const data = await requestJson(`/api/foods/search?${params}`, { signal: controller.signal });
        if (typeof data !== "object" || data === null ||
          !("currentPage" in data) || typeof data.currentPage !== "number" || !Number.isSafeInteger(data.currentPage) || data.currentPage < 1 ||
          !("totalPages" in data) || typeof data.totalPages !== "number" || !Number.isSafeInteger(data.totalPages) || data.totalPages < 0 ||
          !("foods" in data) || !Array.isArray(data.foods) ||
          !data.foods.every((food: unknown) => typeof food === "object" && food !== null &&
            "fdcId" in food && typeof food.fdcId === "number" && Number.isSafeInteger(food.fdcId) && food.fdcId > 0 &&
            "description" in food && typeof food.description === "string" &&
            "dataType" in food && (typeof food.dataType === "string" || food.dataType === null) &&
            "brand" in food && (typeof food.brand === "string" || food.brand === null))) {
          throw new Error("Invalid food search response.");
        }
        if (!controller.signal.aborted) {
          setResults({ key: searchKey, page: data.currentPage, totalPages: data.totalPages, foods: data.foods });
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Food search failed", cause);
        setSearchError(cause instanceof Error ? cause.message : "Could not search foods.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searchKey, page, requestedPage.key, filter.saving, retry]);

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
      setResults(null);
      setRequestedPage({ key: "", page: 1 });
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
          setResults(null);
          setRequestedPage({ key: "", page: 1 });
          setCustomFoods([]);
          setCustomError("");
          setError("");
          setSearchError("");
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
              setResults(null);
              setRequestedPage({ key: "", page: 1 });
              setCustomFoods([]);
            }}>
              <strong>{food.name}</strong><span>Custom food</span>
            </button>
          ))}
          {(filter.saving || loading || (!searchError && !visibleResults)) && <p>Searching USDA...</p>}
          {!filter.saving && !loading && !searchError && visibleResults && visibleResults.foods.length === 0 && <p>{filter.types.length ? "No USDA foods found." : "Select a food type to search USDA."}</p>}
          {!filter.saving && visibleResults?.foods.map((food) => (
            <button type="button" key={food.fdcId} disabled={adding} onClick={() => void add(food.fdcId)}>
              <strong>{food.description}</strong>
              <span>{[food.dataType, food.brand].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          {!filter.saving && visibleResults && visibleResults.totalPages > 1 && (
            <nav className="food-suggestion-pages" aria-label="USDA food search pages">
              <button type="button" disabled={loading || adding || visibleResults.page <= 1} onClick={() => {
                setRequestedPage({ key: searchKey, page: visibleResults.page - 1 });
                setRetry((current) => current + 1);
              }}>Previous</button>
              <span>Page {visibleResults.page.toLocaleString()} of {visibleResults.totalPages.toLocaleString()}</span>
              <button type="button" disabled={loading || adding || visibleResults.page >= visibleResults.totalPages || visibleResults.page >= 9999} onClick={() => {
                setRequestedPage({ key: searchKey, page: visibleResults.page + 1 });
                setRetry((current) => current + 1);
              }}>Next</button>
            </nav>
          )}
        </div>
      )}
      {searchError && <p className="form-error" role="alert">{searchError} <button type="button" className="text-button" onClick={() => setRetry((current) => current + 1)}>Retry USDA search</button></p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {customError && <p className="form-error" role="alert">{customError}</p>}
      {adding && <p className="field-hint" role="status">Adding food...</p>}
    </div>
  );
}

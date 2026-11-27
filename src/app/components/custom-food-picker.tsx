"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { isBuilderFood, type BuilderFood } from "@/lib/meal-builder";

export function CustomFoodPicker({ onAdd }: { onAdd: (food: BuilderFood) => void }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [foods, setFoods] = useState<BuilderFood[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      setFoods([]);
      try {
        const data = await requestJson(`/api/custom-foods?page=${page}`, { signal: controller.signal });
        if (typeof data !== "object" || data === null || !("foods" in data) || !Array.isArray(data.foods) ||
            !data.foods.every(isBuilderFood) || !("hasMore" in data) || typeof data.hasMore !== "boolean") {
          throw new Error("Invalid custom food response.");
        }
        if (!controller.signal.aborted) {
          setFoods(data.foods);
          setHasMore(data.hasMore);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Could not load custom foods", cause);
        setError(cause instanceof Error ? cause.message : "Could not load custom foods.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, page]);

  return (
    <div className="custom-food-picker">
      <button type="button" className="button button-secondary button-small" aria-expanded={open} aria-controls="custom-food-list" onClick={() => {
        setOpen((current) => !current);
        setPage(1);
      }}>{open ? "Hide custom foods" : "Browse custom foods"}</button>
      {open && <section id="custom-food-list" aria-label="Your custom foods">
        {loading && <p className="nutrient-note" role="status">Loading custom foods...</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!loading && !error && foods.length === 0 && <p className="nutrient-note">{page === 1 ? "You don't have any custom foods yet. Create one on the Custom foods page." : "No foods on this page."}</p>}
        {!loading && foods.length > 0 && <ul>
          {foods.map((food) => <li key={food.id}>
            <span>{food.name}</span>
            <button type="button" className="button button-secondary button-small" onClick={() => {
              onAdd(food);
              setOpen(false);
            }} aria-label={`Add ${food.name}`}>Add</button>
          </li>)}
        </ul>}
        {!loading && !error && (page > 1 || hasMore) && <nav className="pagination" aria-label="Custom food pages">
          <button type="button" className="button button-secondary button-small" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" className="button button-secondary button-small" disabled={!hasMore || page >= 9999} onClick={() => setPage((current) => current + 1)}>Next</button>
        </nav>}
      </section>}
    </div>
  );
}

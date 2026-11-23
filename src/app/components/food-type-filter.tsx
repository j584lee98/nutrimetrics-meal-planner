"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { foodTypes, isFoodTypeSelection, type FoodType } from "@/lib/food-types";

function readTypes(value: unknown): FoodType[] {
  if (typeof value !== "object" || value === null || !("types" in value) || !isFoodTypeSelection(value.types)) {
    throw new Error("Invalid food filter response.");
  }
  return value.types;
}

export function useFoodTypeFilter(initial: FoodType[]) {
  const [types, setTypes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const current = version.current;
      try {
        const next = readTypes(await requestJson("/api/foods/preferences"));
        if (active && current === version.current) {
          setTypes(next);
          setError("");
        }
      } catch (cause) {
        if (!active || current !== version.current) return;
        console.error("Could not refresh food filters", cause);
        setError("Could not refresh food filters. Try reloading the page.");
      }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("food-type-preferences");
      channel.current.onmessage = () => { void refresh(); };
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    void refresh();
    return () => {
      active = false;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current?.close();
      channel.current = null;
    };
  }, []);

  async function save(next: FoodType[]) {
    version.current++;
    setSaving(true);
    setError("");
    try {
      const saved = readTypes(await requestJson("/api/foods/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types: next }),
      }));
      version.current++;
      setTypes(saved);
      channel.current?.postMessage("updated");
    } catch (cause) {
      console.error("Could not save food filters", cause);
      setError(cause instanceof Error ? cause.message : "Could not save food filters.");
    } finally {
      setSaving(false);
    }
  }

  return { types, saving, error, save };
}

function FoodTypeChoices({ filter }: { filter: ReturnType<typeof useFoodTypeFilter> }) {
  return foodTypes.map((type) => <label key={type.value}>
    <input type="checkbox" checked={filter.types.includes(type.value)} onChange={(event) => {
      const next = event.target.checked
        ? foodTypes.filter((item) => item.value === type.value || filter.types.includes(item.value)).map((item) => item.value)
        : filter.types.filter((value) => value !== type.value);
      void filter.save(next);
    }} />
    {type.label}
  </label>);
}

export function FoodTypeOptions({ initial }: { initial: FoodType[] }) {
  const filter = useFoodTypeFilter(initial);
  return <section className="search-panel food-type-options" aria-labelledby="food-type-options-heading">
    <h2 id="food-type-options-heading">Food search types</h2>
    <p className="search-intro">Changes save automatically and apply to food searches in Lookup and the meal builder.</p>
    <fieldset className="column-options food-type-options-list" disabled={filter.saving}>
      <legend className="visually-hidden">Food search types</legend>
      <FoodTypeChoices filter={filter} />
    </fieldset>
    {filter.saving && <p className="nutrient-note" role="status">Saving filter...</p>}
    {filter.error && <p className="form-error search-message" role="alert">{filter.error}</p>}
  </section>;
}

export function FoodTypeFilter({ filter }: { filter: ReturnType<typeof useFoodTypeFilter> }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: globalThis.PointerEvent) {
      if (details.current && event.target instanceof Node && !details.current.contains(event.target)) {
        details.current.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return <details ref={details} className="food-type-filter" onKeyDown={(event) => {
    if (event.key === "Escape" && details.current?.open) {
      details.current.open = false;
      details.current.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label="Filter food types" title="Filter food types">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16l-6.5 7.5V19l-3 1v-7.5z" />
      </svg>
    </summary>
    <fieldset className="food-type-menu" disabled={filter.saving}>
      <legend>Food types</legend>
      <FoodTypeChoices filter={filter} />
      {filter.saving && <p role="status">Saving filter...</p>}
    </fieldset>
  </details>;
}

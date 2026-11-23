"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FoodPicker } from "@/app/components/food-picker";
import { requestJson } from "@/lib/client-request";
import type { BuilderFood, NutrientColumn } from "@/lib/meal-builder";
import type { FoodType } from "@/lib/food-types";

type Groups = { macros: NutrientColumn[]; vitamins: NutrientColumn[]; minerals: NutrientColumn[] };

function sourceValues(food?: BuilderFood) {
  const amount = food?.defaultAmount ?? 100;
  return Object.fromEntries((food?.nutrients ?? []).map((nutrient) => [
    nutrient.id, String(nutrient.value * amount / 100),
  ]));
}

export function CustomFoodBuilder({ groups, initialFoodTypes, initialFood }: {
  groups: Groups;
  initialFoodTypes: FoodType[];
  initialFood?: BuilderFood;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialFood?.name ?? "");
  const [amount, setAmount] = useState(String(initialFood?.defaultAmount ?? 100));
  const [unit, setUnit] = useState(initialFood?.defaultUnit ?? (initialFood?.basis === "ml" ? "ml" : "g"));
  const [values, setValues] = useState<Record<number, string>>(() => sourceValues(initialFood));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceNote, setSourceNote] = useState("");
  const [sourceFdcId, setSourceFdcId] = useState<number | null>(null);

  function useFood(food: BuilderFood) {
    if ((name || Object.keys(values).length) && !window.confirm("Replace the current fields with this food's values?")) return;
    setName(food.name);
    setAmount(String(food.defaultAmount ?? 100));
    setUnit(food.defaultUnit ?? (food.basis === "unknown" ? "" : food.basis));
    setValues(sourceValues(food));
    setSourceFdcId(food.fdcId);
    setSourceNote(food.basis === "unknown"
      ? "Check the USDA details and enter the correct unit for these values."
      : "Values were copied for the amount and unit shown. Only the nutrients listed below are copied.");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nutrients = Object.values(groups).flat().flatMap((nutrient) => {
      const value = values[nutrient.id]?.trim();
      return value ? [{ id: nutrient.id, value: Number(value) }] : [];
    });
    if (nutrients.some(({ value }) => !Number.isFinite(value) || value < 0)) {
      setError("Enter non-negative nutrient values, or leave them blank when unknown.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/custom-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amount: Number(amount), unit, nutrients }),
      });
      router.push("/custom-foods");
      router.refresh();
    } catch (cause) {
      console.error("Could not save custom food", cause);
      setError(cause instanceof Error ? cause.message : "Could not save the food.");
      setSaving(false);
    }
  }

  return (
    <form className="builder-panel" onSubmit={save}>
      <p className="eyebrow">CUSTOM FOOD</p>
      <h1>{initialFood ? "Create a modified copy." : "Create a food."}</h1>
      <p className="nutrient-note">Search for a starting point or enter a new food. Saving creates a private food and never changes the original.</p>
      <FoodPicker onAdd={useFood} initialFoodTypes={initialFoodTypes} label="Start with an existing food (optional)" />
      {sourceNote && <p className="nutrient-note" role="status">{sourceNote}</p>}
      {sourceFdcId && <p className="nutrient-note"><a href={`https://fdc.nal.usda.gov/food-details/${sourceFdcId}/nutrients`} target="_blank" rel="noopener noreferrer">Check USDA details <span className="visually-hidden">(opens in a new tab)</span>↗</a></p>}
      <label className="builder-name">Food name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
      <div className="custom-food-serving">
        <label>Default amount<input type="number" min="0.000001" max="100000000" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Default unit<input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={100} placeholder="e.g. g, ml, apple" required /></label>
      </div>
      <h2>Nutrients</h2>
      <p className="nutrient-note">Enter amounts for the default amount and unit above. Leave unknown values blank; enter 0 when known to be zero. Changing the default amount or unit does not recalculate these fields.</p>
      <div className="nutrient-groups custom-food-nutrients">
        {([["Macros", groups.macros], ["Vitamins", groups.vitamins], ["Minerals", groups.minerals]] as const).map(([label, nutrients]) => (
          <fieldset className="nutrient-group" key={label}>
            <legend>{label}</legend>
            {nutrients.map((nutrient) => (
              <label key={nutrient.id}>{nutrient.name} ({nutrient.unit})
                <input type="number" min="0" max="100000000" step="any" value={values[nutrient.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [nutrient.id]: event.target.value }))} />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      <div className="builder-actions"><button className="button" disabled={saving}>{saving ? "Saving..." : "Save custom food"}</button></div>
    </form>
  );
}

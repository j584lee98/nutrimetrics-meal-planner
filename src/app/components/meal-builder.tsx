"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FoodPicker } from "@/app/components/food-picker";
import { requestJson } from "@/lib/client-request";
import { type BuilderEntry, type BuilderFood, type BuilderMeal, type NutrientColumn } from "@/lib/meal-builder";
import type { FoodType } from "@/lib/food-types";

type DraftEntry = {
  key: string;
  food: BuilderFood;
  quantity: string;
  unitLabel: string;
  basisPerUnit: string;
  basis: "g" | "ml" | "";
  choice: string;
};

function draftFromEntry(entry: BuilderEntry): DraftEntry {
  const portionIndex = entry.food.portions.findIndex((portion) =>
    portion.basis === entry.basis && portion.label === entry.unitLabel && portion.amount === entry.basisPerUnit);
  const choice = entry.unitLabel === entry.basis && entry.basisPerUnit === 1
    ? "base" : portionIndex >= 0 ? `portion:${portionIndex}` : "custom";
  return { ...entry, quantity: String(entry.quantity), basisPerUnit: String(entry.basisPerUnit), choice };
}

function scaledValue(entry: DraftEntry, nutrientId: number): number | null {
  const nutrient = entry.food.nutrients.find((item) => item.id === nutrientId);
  const quantity = Number(entry.quantity);
  const conversion = Number(entry.basisPerUnit);
  if (!nutrient || !entry.basis || !entry.unitLabel.trim() || !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(conversion) || conversion <= 0 || quantity * conversion > 100000000) return null;
  return nutrient.value * quantity * conversion / 100;
}

function format(value: number) {
  return value.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

export function MealBuilder({ meal, columns, initialFoodTypes }: { meal?: BuilderMeal; columns: NutrientColumn[]; initialFoodTypes: FoodType[] }) {
  const router = useRouter();
  const [name, setName] = useState(meal?.name ?? "");
  const [entries, setEntries] = useState<DraftEntry[]>(() => meal?.entries.map(draftFromEntry) ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(key: string, change: Partial<DraftEntry>) {
    setEntries((current) => current.map((entry) => entry.key === key ? { ...entry, ...change } : entry));
  }

  function chooseUnit(entry: DraftEntry, choice: string) {
    if (choice === "custom") {
      update(entry.key, { choice, unitLabel: "", basisPerUnit: "" });
      return;
    }
    const portion = choice.startsWith("portion:") ? entry.food.portions[Number(choice.slice(8))] : null;
    const amount = portion?.amount ?? 1;
    const quantity = Number(entry.quantity);
    const oldConversion = Number(entry.basisPerUnit);
    const equivalent = quantity > 0 && oldConversion > 0 ? quantity * oldConversion / amount : quantity;
    update(entry.key, {
      choice,
      unitLabel: portion?.label ?? entry.basis,
      basisPerUnit: String(amount),
      quantity: Number.isFinite(equivalent) && equivalent > 0 ? String(Number(equivalent.toPrecision(10))) : entry.quantity,
    });
  }

  function addFood(food: BuilderFood) {
    const basis = food.basis === "unknown" ? "" : food.basis;
    setEntries((current) => [...current, {
      key: crypto.randomUUID(), food, quantity: "100", basis, unitLabel: basis,
      basisPerUnit: "1", choice: "base",
    }]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter a meal name.");
    if (entries.length > 100) return setError("A meal can contain up to 100 food entries.");
    const payload = entries.map((entry) => ({
      foodId: entry.food.id,
      quantity: Number(entry.quantity),
      unitLabel: entry.unitLabel.trim(),
      basisPerUnit: Number(entry.basisPerUnit),
      basis: entry.basis,
    }));
    if (payload.some((entry) => !entry.basis || !entry.unitLabel || !Number.isFinite(entry.quantity) ||
      entry.quantity <= 0 || !Number.isFinite(entry.basisPerUnit) || entry.basisPerUnit <= 0 ||
      entry.quantity * entry.basisPerUnit > 100000000)) {
      return setError("Choose a nutrient basis and enter a positive amount and conversion for each food.");
    }
    setSaving(true);
    setError("");
    try {
      const url = meal ? `/api/meals/${encodeURIComponent(meal.id)}` : "/api/meals";
      await requestJson(url, {
        method: meal ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), entries: payload }),
      });
      router.push("/meals");
      router.refresh();
    } catch (cause) {
      console.error("Could not save meal", cause);
      setError(cause instanceof Error ? cause.message : "Could not save the meal.");
      setSaving(false);
    }
  }

  return (
    <form className="builder-panel" onSubmit={save}>
      <p className="eyebrow">MEAL BUILDER</p>
      {meal && <p className="nutrient-note">Changes to this meal affect every plan that includes it.</p>}
      <h1>{meal ? "Edit your meal." : "Build a meal."}</h1>
      <label className="builder-name">Meal name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="e.g. Breakfast bowl" /></label>
      <FoodPicker onAdd={addFood} initialFoodTypes={initialFoodTypes} />
      <p className="nutrient-note">Values are estimates based on USDA data. A dash means unavailable; totals marked partial exclude unavailable values. Check USDA details for less-than values and unusual food bases.</p>
      {entries.length === 0 ? <p className="planner-empty">Search above to add foods to this meal.</p> : (
        <div className="table-scroll builder-table">
          <table>
            <thead><tr><th scope="col">Food</th><th scope="col">Amount and unit</th>{columns.map((column) => <th scope="col" key={column.id}>{column.name} ({column.unit})</th>)}<th scope="col"><span className="visually-hidden">Remove</span></th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.key}>
                  <th scope="row">
                    {entry.food.name}
                    {entry.food.fdcId && <a className="builder-source" href={`https://fdc.nal.usda.gov/food-details/${entry.food.fdcId}/nutrients`} target="_blank" rel="noopener noreferrer">USDA details <span className="visually-hidden">(opens in a new tab)</span>↗</a>}
                  </th>
                  <td>
                    <div className="portion-controls">
                      {entry.food.basis === "unknown" && (
                        <label>Nutrient basis per 100
                          <select value={entry.basis} onChange={(event) => {
                            const basis = event.target.value;
                            if (basis === "g" || basis === "ml") update(entry.key, { basis, unitLabel: basis, basisPerUnit: "1", choice: "base" });
                            else update(entry.key, { basis: "", unitLabel: "", basisPerUnit: "1", choice: "base" });
                          }} required>
                            <option value="">Check USDA details</option><option value="g">100 g</option><option value="ml">100 mL</option>
                          </select>
                        </label>
                      )}
                      <label>Amount<input type="number" min="0.000001" step="any" value={entry.quantity} onChange={(event) => update(entry.key, { quantity: event.target.value })} required /></label>
                      <label>Unit
                        <select value={entry.choice} onChange={(event) => chooseUnit(entry, event.target.value)} disabled={!entry.basis}>
                          <option value="base">{entry.basis || "Choose basis"}</option>
                          {entry.food.portions.map((portion, index) => portion.basis === entry.basis && <option key={index} value={`portion:${index}`}>{portion.label}</option>)}
                          <option value="custom">Custom unit</option>
                        </select>
                      </label>
                      {entry.choice === "custom" && <>
                        <label>Unit name<input value={entry.unitLabel} onChange={(event) => update(entry.key, { unitLabel: event.target.value })} placeholder="e.g. tbsp" maxLength={100} required /></label>
                        <label>{entry.basis} per unit<input type="number" min="0.000001" step="any" value={entry.basisPerUnit} onChange={(event) => update(entry.key, { basisPerUnit: event.target.value })} required /></label>
                      </>}
                    </div>
                  </td>
                  {columns.map((column) => {
                    const value = scaledValue(entry, column.id);
                    return <td key={column.id}>{value === null ? "—" : format(value)}</td>;
                  })}
                  <td><button className="text-button" type="button" onClick={() => setEntries((current) => current.filter((item) => item.key !== entry.key))} aria-label={`Remove ${entry.food.name}`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td></td>{columns.map((column) => {
              const values = entries.map((entry) => scaledValue(entry, column.id));
              const available = values.filter((value): value is number => value !== null);
              return <td key={column.id}>{available.length ? `${format(available.reduce((sum, value) => sum + value, 0))}${available.length < values.length ? " (partial)" : ""}` : "—"}</td>;
            })}<td></td></tr></tfoot>
          </table>
        </div>
      )}
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      <div className="builder-actions"><button className="button" disabled={saving}>{saving ? "Saving..." : "Save meal"}</button></div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { defaultNutrients, type BuilderMeal } from "@/lib/meal-builder";
import { displayTotal, mealTotal, planTotal } from "@/lib/nutrition-totals";

export function PlanBuilder({ meals, plan }: {
  meals: BuilderMeal[];
  plan?: { id: string; name: string; mealIds: string[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(plan?.name ?? "");
  const [mealIds, setMealIds] = useState<string[]>(plan?.mealIds ?? []);
  const [selected, setSelected] = useState(defaultNutrients.map((nutrient) => nutrient.id));
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const chosen = mealIds.map((id) => meals.find((meal) => meal.id === id)).filter((meal): meal is BuilderMeal => !!meal);
  const nutrients = useMemo(() => {
    const all = new Map(defaultNutrients.map((nutrient) => [nutrient.id, nutrient]));
    for (const meal of meals.filter((item) => mealIds.includes(item.id))) {
      for (const entry of meal.entries) for (const nutrient of entry.food.nutrients) {
        all.set(nutrient.id, { id: nutrient.id, name: nutrient.name, unit: nutrient.unit });
      }
    }
    return [...all.values()];
  }, [meals, mealIds]);
  const columns = nutrients.filter((nutrient) => selected.includes(nutrient.id));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter a plan name.");
    if (!mealIds.length) return setError("Add at least one meal.");
    if (chosen.length !== mealIds.length) return setError("A selected meal is no longer available. Reload the page.");
    setSaving(true);
    setError("");
    try {
      await requestJson(plan ? `/api/meal-plans/${encodeURIComponent(plan.id)}` : "/api/meal-plans", {
        method: plan ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), mealIds }),
      });
      router.push("/plans");
      router.refresh();
    } catch (cause) {
      console.error("Could not save plan", cause);
      setError(cause instanceof Error ? cause.message : "Could not save the plan.");
      setSaving(false);
    }
  }

  return (
    <form className="builder-panel" onSubmit={save}>
      <p className="eyebrow">MEAL PLAN BUILDER</p>
      <h1>{plan ? "Edit your plan." : "Build a plan."}</h1>
      <label className="builder-name">Plan name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
      <div className="plan-meal-picker">
        <label htmlFor="plan-meal">Add a meal</label>
        <div className="plan-meal-picker-row">
          <select id="plan-meal" value={choice} onChange={(event) => setChoice(event.target.value)}>
            <option value="">Choose a meal</option>
            {meals.filter((meal) => !mealIds.includes(meal.id)).map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
          </select>
          <button type="button" className="button button-secondary" disabled={!choice || mealIds.length >= 100} onClick={() => {
            if (meals.some((meal) => meal.id === choice) && !mealIds.includes(choice)) setMealIds([...mealIds, choice]);
            setChoice("");
          }}>Add meal</button>
        </div>
        <p className="nutrient-note">Need a meal? <Link href="/meals/new" target="_blank" rel="noopener noreferrer">Build one in a new tab</Link>, then refresh the meal list here.</p>
        <button type="button" className="button button-secondary button-small" onClick={() => router.refresh()}>Refresh meal list</button>
      </div>
      <details className="column-picker">
        <summary>Choose nutrient columns</summary>
        <div className="column-options">
          {nutrients.map((nutrient) => <label key={nutrient.id}>
            <input type="checkbox" checked={selected.includes(nutrient.id)} onChange={(event) =>
              setSelected((current) => event.target.checked ? [...current, nutrient.id] : current.filter((id) => id !== nutrient.id))} />
            {nutrient.name} ({nutrient.unit})
          </label>)}
        </div>
      </details>
      <p className="nutrient-note">Values are estimates. A dash means unavailable; partial totals exclude missing values. Meal changes affect all plans using them.</p>
      {chosen.length === 0 ? <p className="planner-empty">Add at least one meal to your plan.</p> : (
        <div className="table-scroll builder-table">
          <table>
            <thead><tr><th scope="col">Meal</th>{columns.map((column) => <th key={column.id} scope="col">{column.name} ({column.unit})</th>)}<th scope="col"><span className="visually-hidden">Remove</span></th></tr></thead>
            <tbody>{chosen.map((meal) => <tr key={meal.id}>
              <th scope="row">{meal.name}</th>
              {columns.map((column) => <td key={column.id}>{displayTotal(mealTotal(meal, column.id))}</td>)}
              <td><button className="text-button" type="button" onClick={() => setMealIds((ids) => ids.filter((id) => id !== meal.id))} aria-label={`Remove ${meal.name} from plan`}>Remove</button></td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row">Total</th>{columns.map((column) => {
              return <td key={column.id}>{displayTotal(planTotal(chosen, column.id))}</td>;
            })}<td></td></tr></tfoot>
          </table>
        </div>
      )}
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      <div className="builder-actions"><button className="button" disabled={saving}>{saving ? "Saving..." : "Save plan"}</button></div>
    </form>
  );
}

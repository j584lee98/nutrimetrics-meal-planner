"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { MealPlan } from "@/lib/meal-plans";

export function MealPlanner() {
  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPlans(signal?: AbortSignal) {
    const data = await requestJson("/api/meal-plans", { signal });
    if (!Array.isArray(data)) throw new Error("Invalid meal plan response.");
    setPlans(data);
  }

  useEffect(() => {
    const controller = new AbortController();
    loadPlans(controller.signal).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      console.error("Could not load meal plans", cause);
      setError(cause instanceof Error ? cause.message : "Could not load meal plans.");
    });
    return () => controller.abort();
  }, []);

  async function remove(url: string, confirmation: string) {
    if (saving || !window.confirm(confirmation)) return;
    setSaving(true);
    setError("");
    let saved = false;
    try {
      await requestJson(url, { method: "DELETE" });
      saved = true;
      await loadPlans();
    } catch (cause) {
      console.error("Meal plan request failed", cause);
      setError(saved ? "Your change was saved, but the list could not be refreshed. Reload the page."
        : cause instanceof Error ? cause.message : "Could not save your change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="search-panel planner-panel" aria-labelledby="meal-plans-heading">
      <p className="eyebrow">YOUR MEAL PLANS</p>
      <h2 id="meal-plans-heading">Your plans and meals.</h2>
      <p className="search-intro">Create meals in a plan, then edit their foods in the meal builder.</p>
      <Link href="/plans/new" className="button button-small">Create plan</Link>
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      {plans === null && !error && <p className="search-message" role="status">Loading your plans...</p>}
      {plans?.length === 0 && <p className="planner-empty">You don&apos;t have any plans yet. Create one to get started.</p>}
      {plans?.map((plan) => (
        <article className="plan-card" key={plan.id}>
          <div className="plan-heading">
            <h3>{plan.name}</h3>
            <button type="button" className="text-button" disabled={saving} onClick={() => void remove(`/api/meal-plans/${encodeURIComponent(plan.id)}`, `Delete "${plan.name}" and all of its meals? This cannot be undone.`)}>Delete plan</button>
          </div>
          {plan.meals.length === 0 ? <p className="planner-empty">No meals yet.</p> : (
            <ul className="meal-list">
              {plan.meals.map((meal) => (
                <li key={meal.id}>
                  <Link href={`/meals/${encodeURIComponent(meal.id)}/edit`}>{meal.name}</Link>
                  <button type="button" className="text-button" disabled={saving} onClick={() => void remove(`/api/meals/${encodeURIComponent(meal.id)}`, `Delete "${meal.name}" and its food entries? This cannot be undone.`)} aria-label={`Delete ${meal.name}`}>Delete</button>
                </li>
              ))}
            </ul>
          )}
          <Link className="button button-secondary button-small" href={`/plans/${encodeURIComponent(plan.id)}/meals/new`}>Build a meal</Link>
        </article>
      ))}
    </section>
  );
}

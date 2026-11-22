"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { MealPlan } from "@/lib/meal-plans";

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    if (response.headers.get("content-type")?.includes("application/json")) {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function MealPlanner() {
  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestJson("/api/meal-plans", { signal: controller.signal })
      .then((data: MealPlan[]) => setPlans(data))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not load meal plans", cause);
        setError(cause instanceof Error ? cause.message : "Could not load meal plans.");
      });
    return () => controller.abort();
  }, []);

  async function mutate(url: string, method: "POST" | "DELETE", body?: object): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setError("");
    let saved = false;
    try {
      await requestJson(url, {
        method,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      saved = true;
      const data: MealPlan[] = await requestJson("/api/meal-plans");
      setPlans(data);
    } catch (cause) {
      console.error("Meal plan request failed", cause);
      setError(saved
        ? "Your change was saved, but the list could not be refreshed. Reload the page."
        : cause instanceof Error ? cause.message : "Could not save your change.");
    } finally {
      setSaving(false);
    }
    return saved;
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) {
      setError("Enter a plan name.");
      return;
    }
    if (await mutate("/api/meal-plans", "POST", { name })) form.reset();
  }

  async function createMeal(event: FormEvent<HTMLFormElement>, planId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const date = String(data.get("date") ?? "");
    if (!name) {
      setError("Enter a meal name.");
      return;
    }
    if (await mutate(`/api/meal-plans/${encodeURIComponent(planId)}/meals`, "POST", { name, date })) form.reset();
  }

  async function removePlan(plan: MealPlan) {
    if (window.confirm(`Delete "${plan.name}" and all of its meals? This cannot be undone.`)) {
      await mutate(`/api/meal-plans/${encodeURIComponent(plan.id)}`, "DELETE");
    }
  }

  async function removeMeal(id: string, name: string) {
    if (window.confirm(`Delete "${name}" and its food entries? This cannot be undone.`)) {
      await mutate(`/api/meals/${encodeURIComponent(id)}`, "DELETE");
    }
  }

  return (
    <section className="search-panel planner-panel" aria-labelledby="meal-plans-heading">
      <p className="eyebrow">YOUR MEAL PLANS</p>
      <h2 id="meal-plans-heading">Plan your meals.</h2>
      <p className="search-intro">Create a plan, then add meals for the days you want to plan.</p>
      <form className="planner-create" onSubmit={createPlan}>
        <label htmlFor="plan-name">Plan name</label>
        <div className="planner-form-row">
          <input id="plan-name" name="name" placeholder="e.g. Weekly plan" maxLength={100} required />
          <button className="button" type="submit" disabled={saving}>Create plan</button>
        </div>
      </form>
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      {plans === null && !error && <p className="search-message" role="status">Loading your plans...</p>}
      {plans?.length === 0 && <p className="planner-empty">You don&apos;t have any plans yet. Create one to get started.</p>}
      {plans?.map((plan) => (
        <article className="plan-card" key={plan.id}>
          <div className="plan-heading">
            <h3>{plan.name}</h3>
            <button type="button" className="text-button" disabled={saving} onClick={() => void removePlan(plan)}>Delete plan</button>
          </div>
          {plan.meals.length === 0 ? (
            <p className="planner-empty">No meals yet. Add one below.</p>
          ) : (
            <ul className="meal-list">
              {plan.meals.map((meal) => (
                <li key={meal.id}>
                  <div><time dateTime={meal.date}>{meal.date}</time><strong>{meal.name}</strong></div>
                  <button type="button" className="text-button" disabled={saving} onClick={() => void removeMeal(meal.id, meal.name)} aria-label={`Delete ${meal.name} on ${meal.date}`}>Delete</button>
                </li>
              ))}
            </ul>
          )}
          <form className="meal-form" onSubmit={(event) => void createMeal(event, plan.id)}>
            <label>Meal name<input name="name" placeholder="e.g. Breakfast" maxLength={100} required /></label>
            <label>Date<input name="date" type="date" min="0001-01-01" max="9999-12-31" required /></label>
            <button className="button button-secondary" type="submit" disabled={saving}>Add meal</button>
          </form>
        </article>
      ))}
      <p className="source-note">Food selection and nutrition totals for meals are coming next.</p>
    </section>
  );
}

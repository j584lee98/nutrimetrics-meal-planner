"use client";

import { useState } from "react";
import { defaultNutrients, type BuilderMeal } from "@/lib/meal-builder";
import { displayTotal, entryValue, mealTotal, planTotal } from "@/lib/nutrition-totals";

export function NutrientBreakdown(props: { kind: "meal"; meal: BuilderMeal } | { kind: "plan"; name: string; meals: BuilderMeal[] }) {
  const meals = props.kind === "meal" ? [props.meal] : props.meals;
  const name = props.kind === "meal" ? props.meal.name : props.name;
  const [selected, setSelected] = useState(() => defaultNutrients.map((nutrient) => nutrient.id));
  const nutrients = new Map(defaultNutrients.map((nutrient) => [nutrient.id, nutrient]));
  for (const meal of meals) {
    for (const entry of meal.entries) {
      for (const nutrient of entry.food.nutrients) {
        nutrients.set(nutrient.id, { id: nutrient.id, name: nutrient.name, unit: nutrient.unit });
      }
    }
  }
  const columns = [...nutrients.values()].filter((nutrient) => selected.includes(nutrient.id));
  if (props.kind === "meal" ? props.meal.entries.length === 0 : props.meals.length === 0) {
    return <p className="planner-empty">{props.kind === "meal" ? "No foods in this meal." : "No meals in this plan."}</p>;
  }

  return (
    <div className="nutrient-breakdown">
      <details className="column-picker">
        <summary>Choose nutrient columns</summary>
        <p className="nutrient-note">Column choices apply to this table until you leave or reload the page.</p>
        <div className="column-options">
          {[...nutrients.values()].map((nutrient) => (
            <label key={nutrient.id}>
              <input type="checkbox" checked={selected.includes(nutrient.id)} onChange={(event) =>
                setSelected((current) => event.target.checked ? [...current, nutrient.id] : current.filter((id) => id !== nutrient.id))} />
              {nutrient.name} ({nutrient.unit})
            </label>
          ))}
        </div>
      </details>
      <div className="table-scroll nutrient-table" role="region" aria-label={`${name} nutrient table`} tabIndex={0}>
        <table>
          <caption className="visually-hidden">{name} nutrient breakdown</caption>
          <thead><tr>
            <th scope="col">{props.kind === "meal" ? "Food" : "Meal"}</th>
            {props.kind === "meal" && <th scope="col">Amount</th>}
            {columns.map((column) => <th scope="col" key={column.id}>{column.name} ({column.unit})</th>)}
          </tr></thead>
          <tbody>
            {props.kind === "meal" ? props.meal.entries.map((entry) => (
              <tr key={entry.key}>
                <th scope="row">{entry.food.name}</th>
                <td>{entry.quantity} {entry.unitLabel}</td>
                {columns.map((column) => {
                  const value = entryValue(entry, column.id);
                  return <td key={column.id}>{displayTotal(value === null ? null : { value, partial: false })}</td>;
                })}
              </tr>
            )) : props.meals.map((meal) => (
              <tr key={meal.id}>
                <th scope="row">{meal.name}</th>
                {columns.map((column) => <td key={column.id}>{displayTotal(mealTotal(meal, column.id))}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <th scope="row">Total</th>
            {props.kind === "meal" && <td></td>}
            {columns.map((column) => <td key={column.id}>{displayTotal(planTotal(meals, column.id))}</td>)}
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

import { type BuilderMeal, type NutrientColumn } from "@/lib/meal-builder";
import { displayTotal, entryValue, mealTotal, planTotal } from "@/lib/nutrition-totals";

export function NutrientBreakdown(props: ({ kind: "meal"; meal: BuilderMeal } | { kind: "plan"; name: string; meals: BuilderMeal[] }) & { columns: NutrientColumn[] }) {
  const meals = props.kind === "meal" ? [props.meal] : props.meals;
  const name = props.kind === "meal" ? props.meal.name : props.name;
  const columns = props.columns;
  if (props.kind === "meal" ? props.meal.entries.length === 0 : props.meals.length === 0) {
    return <p className="planner-empty">{props.kind === "meal" ? "No foods in this meal." : "No meals in this plan."}</p>;
  }

  return (
    <div className="nutrient-breakdown">
      <div className="table-scroll nutrient-table" role="region" aria-label={`${name} nutrient table`} tabIndex={0}>
        <table>
          <caption className="visually-hidden">{name} nutrient breakdown</caption>
          <thead><tr>
            <th scope="col">{props.kind === "meal" ? "Food" : "Meal"}</th>
            {props.kind === "meal" && <><th scope="col">Amount</th><th scope="col">Unit</th></>}
            {columns.map((column) => <th scope="col" key={column.id}>{column.name} ({column.unit})</th>)}
          </tr></thead>
          <tbody>
            {props.kind === "meal" ? props.meal.entries.map((entry) => (
              <tr key={entry.key}>
                <th scope="row">{entry.food.name}</th>
                <td>{entry.quantity}</td><td>{entry.unitLabel}</td>
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
            {props.kind === "meal" && <><td></td><td></td></>}
            {columns.map((column) => <td key={column.id}>{displayTotal(planTotal(meals, column.id))}</td>)}
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

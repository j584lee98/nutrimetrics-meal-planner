import type { BuilderMeal } from "@/lib/meal-builder";
import { displayTotal, planTotal } from "@/lib/nutrition-totals";

const macros = [
  { id: 1008, label: "Calories", unit: "kcal" },
  { id: 1005, label: "Carbs", unit: "g" },
  { id: 1003, label: "Protein", unit: "g" },
  { id: 1004, label: "Fat", unit: "g" },
];

export function MacroSummary({ meals }: { meals: BuilderMeal[] }) {
  return (
    <dl className="macro-summary">
      {macros.map((macro) => (
        <div key={macro.id}>
          <dt>{macro.label} ({macro.unit})</dt>
          <dd>{displayTotal(planTotal(meals, macro.id))}</dd>
        </div>
      ))}
    </dl>
  );
}

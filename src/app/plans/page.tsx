import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { DeleteItemButton } from "@/app/components/delete-item-button";
import { MacroSummary } from "@/app/components/macro-summary";
import { NutrientBreakdown } from "@/app/components/nutrient-breakdown";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mealInclude, toBuilderMeal } from "@/lib/builder-food";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";

export default async function PlansPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const columns = await getNutrientPreferences(session.user.id);
  const plans = await db.mealPlan.findMany({
    where: { userId: session.user.id },
    include: { meals: { include: { meal: { include: mealInclude } }, orderBy: [{ position: "asc" }, { mealId: "asc" }] } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return (
    <main className="auth-page">
      <AppNav current="plans" />
      <div className="lookup-heading"><h1>Plans</h1></div>
      <section className="search-panel" aria-label="Meal plans">
        <p className="search-intro">Create plans from your reusable meals.</p>
        <Link href="/plans/new" className="button button-small">Create plan</Link>
        <p className="nutrient-note">Values are estimates. A dash means unavailable; partial totals exclude missing values.</p>
        {plans.length === 0 && <p className="planner-empty">You don&apos;t have any plans yet.</p>}
        {plans.map((plan) => {
          const meals = plan.meals.map(({ meal }) => toBuilderMeal(meal, session.user.id));
          return (
          <article className="plan-card" key={plan.id}>
            <div className="plan-heading">
              <h2>{plan.name}</h2>
              <DeleteItemButton id={plan.id} name={plan.name} kind="plan" />
            </div>
            <MacroSummary meals={meals} />
            <NutrientBreakdown kind="plan" name={plan.name} meals={meals} columns={columns} />
            <Link className="button button-secondary button-small" href={`/plans/${encodeURIComponent(plan.id)}/edit`}>Edit plan<span className="visually-hidden"> {plan.name}</span></Link>
          </article>
          );
        })}
      </section>
    </main>
  );
}

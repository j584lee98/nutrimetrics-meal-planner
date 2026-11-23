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

export default async function MealsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const columns = await getNutrientPreferences(session.user.id);
  const meals = await db.meal.findMany({
    where: { userId: session.user.id },
    include: { ...mealInclude, _count: { select: { plans: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return (
    <main className="auth-page">
      <AppNav current="meals" />
      <div className="lookup-heading"><h1>Meals</h1></div>
      <section className="search-panel" aria-label="Meals">
        <p className="search-intro">Meals can be used in multiple plans. Editing a meal updates every plan that includes it.</p>
        <Link href="/meals/new" className="button button-small">Create meal</Link>
        <p className="nutrient-note">Values are estimates. A dash means unavailable; partial totals exclude missing values.</p>
        {meals.length === 0 && <p className="planner-empty">You don&apos;t have any meals yet.</p>}
        {meals.map((meal) => {
          const builderMeal = toBuilderMeal(meal, session.user.id);
          return (
          <article className="plan-card" key={meal.id}>
            <div className="plan-heading">
              <h2>{meal.name}</h2>
              <DeleteItemButton id={meal.id} name={meal.name} kind="meal" planCount={meal._count.plans} />
            </div>
            {meal._count.plans > 0 && <p className="meal-usage">Used in {meal._count.plans} {meal._count.plans === 1 ? "plan" : "plans"}</p>}
            <MacroSummary meals={[builderMeal]} />
            <NutrientBreakdown kind="meal" meal={builderMeal} columns={columns} />
            <Link className="button button-secondary button-small" href={`/meals/${encodeURIComponent(meal.id)}/edit`}>Edit meal<span className="visually-hidden"> {meal.name}</span></Link>
          </article>
          );
        })}
      </section>
    </main>
  );
}

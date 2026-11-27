import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PlanBuilder } from "@/app/components/plan-builder";
import { db } from "@/lib/db";
import { mealInclude, toBuilderMeal } from "@/lib/builder-food";
import { AppNav } from "@/app/components/app-nav";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";

export default async function NewPlanPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const columns = await getNutrientPreferences(session.user.id);
  const meals = await db.meal.findMany({ where: { userId: session.user.id }, include: mealInclude, orderBy: [{ name: "asc" }, { id: "asc" }] });
  return (
    <main className="auth-page builder-page">
      <AppNav current="plans" documentNavigation />
      <a href="/plans" className="back-link builder-back-link">← Back to your plans</a>
      <PlanBuilder meals={meals.map((meal) => toBuilderMeal(meal, session.user.id))} columns={columns} />
    </main>
  );
}

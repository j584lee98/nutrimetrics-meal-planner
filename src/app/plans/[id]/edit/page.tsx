import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PlanBuilder } from "@/app/components/plan-builder";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mealInclude, toBuilderMeal } from "@/lib/builder-food";
import { AppNav } from "@/app/components/app-nav";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { id } = await params;
  const [plan, meals] = await Promise.all([
    db.mealPlan.findFirst({
      where: { id, userId: session.user.id },
      include: { meals: { orderBy: [{ position: "asc" }, { mealId: "asc" }] } },
    }),
    db.meal.findMany({ where: { userId: session.user.id }, include: mealInclude, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  if (!plan) notFound();
  const columns = await getNutrientPreferences(session.user.id);
  return (
    <main className="auth-page builder-page">
      <AppNav current="plans" documentNavigation />
      <a href="/plans" className="back-link builder-back-link">← Back to your plans</a>
      <PlanBuilder meals={meals.map((meal) => toBuilderMeal(meal, session.user.id))} columns={columns}
        plan={{ id: plan.id, name: plan.name, mealIds: plan.meals.map((meal) => meal.mealId) }} />
    </main>
  );
}

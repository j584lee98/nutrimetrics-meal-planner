import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MealBuilder } from "@/app/components/meal-builder";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mealInclude, toBuilderMeal } from "@/lib/builder-food";
import { AppNav } from "@/app/components/app-nav";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";

export default async function EditMealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { id } = await params;
  const meal = await db.meal.findFirst({
    where: { id, userId: session.user.id },
    include: mealInclude,
  });
  if (!meal) notFound();
  const columns = await getNutrientPreferences(session.user.id);
  return (
    <main className="auth-page builder-page">
      <AppNav current="meals" />
      <Link href="/meals" className="back-link builder-back-link">← Back to your meals</Link>
      <MealBuilder meal={toBuilderMeal(meal, session.user.id)} columns={columns} />
    </main>
  );
}

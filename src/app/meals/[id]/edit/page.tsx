import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MealBuilder } from "@/app/components/meal-builder";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { foodInclude, toBuilderFood } from "@/lib/builder-food";
import type { BuilderEntry } from "@/lib/meal-builder";

export default async function EditMealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { id } = await params;
  const meal = await db.meal.findFirst({
    where: { id, userId: session.user.id },
    include: {
      mealPlan: { select: { id: true, name: true } },
      entries: { include: { food: { include: foodInclude } }, orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  });
  if (!meal) notFound();
  const entries = meal.entries.map((entry): BuilderEntry => {
    if (entry.food.ownerId && entry.food.ownerId !== session.user.id) throw new Error("Meal contains an inaccessible food.");
    if (entry.basis !== "g" && entry.basis !== "ml") throw new Error("Meal contains an invalid nutrient basis.");
    return {
      key: entry.id,
      food: toBuilderFood(entry.food),
      quantity: entry.quantity,
      unitLabel: entry.unitLabel,
      basisPerUnit: entry.basisPerUnit,
      basis: entry.basis,
    };
  });

  return (
    <main className="auth-page builder-page">
      <Link href="/dashboard" className="back-link">← Back to your plans</Link>
      <MealBuilder planId={meal.mealPlan.id} planName={meal.mealPlan.name} meal={{ id: meal.id, name: meal.name, entries }} />
    </main>
  );
}

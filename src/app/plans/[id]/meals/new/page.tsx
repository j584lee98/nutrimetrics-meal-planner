import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MealBuilder } from "@/app/components/meal-builder";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewMealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { id } = await params;
  const plan = await db.mealPlan.findFirst({ where: { id, userId: session.user.id }, select: { id: true, name: true } });
  if (!plan) notFound();

  return (
    <main className="auth-page builder-page">
      <Link href="/dashboard" className="back-link">← Back to your plans</Link>
      <MealBuilder planId={plan.id} planName={plan.name} />
    </main>
  );
}

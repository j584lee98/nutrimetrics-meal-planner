import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MealBuilder } from "@/app/components/meal-builder";
import { auth } from "@/lib/auth";
import { AppNav } from "@/app/components/app-nav";

export default async function NewMealPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return (
    <main className="auth-page builder-page">
      <AppNav current="meals" />
      <Link href="/meals" className="back-link builder-back-link">← Back to your meals</Link>
      <MealBuilder />
    </main>
  );
}

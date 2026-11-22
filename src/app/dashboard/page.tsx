import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/app/components/sign-out-button";
import { FoodSearch } from "@/app/components/food-search";
import { MealPlanner } from "@/app/components/meal-planner";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <main className="auth-page">
      <Link href="/" className="back-link">← Back to NutriMetrics</Link>
      <section className="account-bar">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Welcome, {session.user.name}.</h1>
          <p className="auth-description">Signed in as {session.user.email}.</p>
        </div>
        <SignOutButton />
      </section>
      <MealPlanner />
      <FoodSearch />
    </main>
  );
}

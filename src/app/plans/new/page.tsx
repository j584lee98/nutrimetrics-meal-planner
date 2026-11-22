import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreatePlanForm } from "@/app/components/create-plan-form";

export default async function NewPlanPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return (
    <main className="auth-page">
      <Link href="/dashboard" className="back-link">← Back to your plans</Link>
      <section className="auth-card">
        <p className="eyebrow">YOUR MEAL PLANS</p>
        <h1>Create a plan.</h1>
        <p className="auth-description">Give your plan a name, then build meals inside it.</p>
        <CreatePlanForm />
      </section>
    </main>
  );
}

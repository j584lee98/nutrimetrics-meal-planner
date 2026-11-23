import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { SignOutButton } from "@/app/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <main className="auth-page">
      <AppNav />
      <section className="account-bar">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Welcome, {session.user.name}.</h1>
          <p className="auth-description">Signed in as {session.user.email}.</p>
        </div>
        <SignOutButton />
      </section>
    </main>
  );
}

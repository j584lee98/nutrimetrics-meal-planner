import Link from "next/link";
import { AuthForm } from "@/app/components/auth-form";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="back-link">← Back to NutriMetrics</Link>
      <AuthForm mode="sign-in" />
    </main>
  );
}

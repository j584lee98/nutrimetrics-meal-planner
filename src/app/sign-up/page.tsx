import Link from "next/link";
import { AuthForm } from "@/app/components/auth-form";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <Link href="/" className="back-link">← Back to NutriMetrics</Link>
      <AuthForm mode="sign-up" />
    </main>
  );
}

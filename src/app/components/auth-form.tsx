"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name: String(form.get("name") ?? "").trim(),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message || "Unable to authenticate. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      console.error("Authentication request failed", cause);
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">YOUR PERSONAL SPACE</p>
      <h1>{isSignUp ? "Create your account." : "Welcome back."}</h1>
      <p className="auth-description">
        {isSignUp ? "Start building a more personal approach to nutrition." : "Sign in to your NutriMetrics account."}
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignUp && (
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required maxLength={100} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={isSignUp ? 12 : undefined}
            maxLength={128}
            aria-describedby={isSignUp ? "password-hint" : undefined}
          />
        </label>
        {isSignUp && <p className="field-hint" id="password-hint">Use at least 12 characters.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        {isSignUp ? "Already have an account? " : "New to NutriMetrics? "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"}>
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

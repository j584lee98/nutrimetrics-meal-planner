"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AuthNav() {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending) return <span className="nav-loading">Loading account...</span>;
  if (error) return <span className="nav-loading" role="alert">Could not load account.</span>;

  return (
    <nav className="auth-nav" aria-label="Account">
      {session ? (
        <Link className="button button-small" href="/dashboard">My account</Link>
      ) : (
        <>
          <Link className="nav-link" href="/sign-in">Sign in</Link>
          <Link className="button button-small" href="/sign-up">Create account</Link>
        </>
      )}
    </nav>
  );
}

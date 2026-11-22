"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message || "Could not sign out. Please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (cause) {
      console.error("Sign-out request failed", cause);
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className="button button-secondary" onClick={signOut} disabled={pending}>
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

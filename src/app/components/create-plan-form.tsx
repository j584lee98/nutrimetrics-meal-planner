"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";

export function CreatePlanForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) return setError("Enter a plan name.");
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/meal-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      console.error("Could not create plan", cause);
      setError(cause instanceof Error ? cause.message : "Could not create plan.");
      setSaving(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Plan name<input name="name" placeholder="e.g. Weekly plan" maxLength={100} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button" disabled={saving}>Create plan</button>
    </form>
  );
}

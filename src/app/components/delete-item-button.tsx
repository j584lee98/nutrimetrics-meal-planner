"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";

export function DeleteItemButton({ id, name, kind, planCount = 0 }: {
  id: string;
  name: string;
  kind: "plan" | "meal" | "food";
  planCount?: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    setError("");
    if (kind === "meal" && planCount > 0) {
      setError("Remove this meal from all plans before deleting it.");
      return;
    }
    const confirmation = kind === "plan"
      ? `Delete "${name}"? Its meals will remain in your meal library.`
      : kind === "meal" ? `Delete "${name}" and its food entries? This cannot be undone.`
      : `Delete "${name}"? This cannot be undone.`;
    if (!window.confirm(confirmation)) return;
    setPending(true);
    try {
      await requestJson(`${kind === "plan" ? "/api/meal-plans" : kind === "meal" ? "/api/meals" : "/api/custom-foods"}/${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } catch (cause) {
      console.error(`Could not delete ${kind}`, cause);
      setError(cause instanceof Error ? cause.message : `Could not delete the ${kind}.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className="text-button" disabled={pending} onClick={() => void remove()} aria-label={`Delete ${name}`}>
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

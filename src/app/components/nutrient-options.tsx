"use client";

import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import type { NutrientColumn } from "@/lib/meal-builder";

export function NutrientOptions({ catalog, initial }: { catalog: NutrientColumn[]; initial: NutrientColumn[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial.map((nutrient) => nutrient.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [drag, setDrag] = useState<{ id: number; offset: number; target: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const pointer = useRef<{ id: number; pointerId: number; startY: number; startScroll: number; active: boolean; target: number } | null>(null);
  const byId = new Map(catalog.map((nutrient) => [nutrient.id, nutrient]));

  function move(id: number, target: number) {
    const index = selected.indexOf(id);
    if (index < 0 || target < 0 || target >= selected.length || index === target) return;
    const next = [...selected];
    next.splice(index, 1);
    next.splice(target, 0, id);
    setSelected(next);
    setAnnouncement(`${byId.get(id)?.name} moved to position ${target + 1} of ${next.length}.`);
    setMessage("");
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, id: number) {
    if (!event.isPrimary || event.button !== 0) return;
    pointer.current = { id, pointerId: event.pointerId, startY: event.clientY, startScroll: window.scrollY, active: false, target: selected.indexOf(id) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const offset = event.clientY - current.startY + window.scrollY - current.startScroll;
    if (!current.active && Math.abs(offset) < 5) return;
    current.active = true;
    const items = Array.from(listRef.current?.children ?? []).filter((item) => item.getAttribute("data-nutrient-id") !== String(current.id));
    const target = items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    current.target = target === -1 ? items.length : target;
    setDrag({ id: current.id, offset, target: current.target });
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled && current.active) move(current.id, current.target);
    pointer.current = null;
    setDrag(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await requestJson("/api/options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutrientIds: selected }),
      });
      setMessage("Options saved.");
      router.refresh();
    } catch (cause) {
      console.error("Could not save options", cause);
      setError(cause instanceof Error ? cause.message : "Could not save options.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="search-panel" onSubmit={save}>
      <p className="search-intro">Choose nutrients for all tables and arrange their display order.</p>
      <h2>Selected nutrients</h2>
      <p className="nutrient-note" id="reorder-instructions">Drag nutrients to reorder them, or focus one and use the up and down arrow keys.</p>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
      {selected.length === 0 && <p className="nutrient-note">No nutrients selected.</p>}
      <ol className="selected-nutrients" ref={listRef}>
        {selected.map((id, index) => {
          const nutrient = byId.get(id);
          if (!nutrient) return null;
          const draggedIndex = drag ? selected.indexOf(drag.id) : -1;
          const dropPosition = drag && index === drag.target && drag.target !== draggedIndex
            ? drag.target < draggedIndex ? "before" : "after" : undefined;
          return <li key={id} data-nutrient-id={id} data-drop={dropPosition} className={drag?.id === id ? "is-dragging" : undefined}
            style={drag?.id === id ? { transform: `translateY(${drag.offset}px)` } : undefined}>
            <button type="button" className="nutrient-drag" aria-label={`${nutrient.name} (${nutrient.unit}), position ${index + 1} of ${selected.length}`} aria-describedby="reorder-instructions"
              onPointerDown={(event) => startDrag(event, id)} onPointerMove={updateDrag}
              onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event, true)}
              onLostPointerCapture={(event) => endDrag(event, true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(id, index + (event.key === "ArrowUp" ? -1 : 1));
                }
              }}>
              <span className="nutrient-drag-grip" aria-hidden="true">⠿</span>
              <span>{nutrient.name} ({nutrient.unit})</span>
            </button>
          </li>;
        })}
      </ol>
      <h2>Available nutrients</h2>
      <div className="column-options">
        {catalog.map((nutrient) => <label key={nutrient.id}>
          <input type="checkbox" checked={selected.includes(nutrient.id)} onChange={(event) => {
            setSelected((current) => event.target.checked ? [...current, nutrient.id] : current.filter((id) => id !== nutrient.id));
            setMessage("");
          }} />
          {nutrient.name} ({nutrient.unit})
        </label>)}
      </div>
      {error && <p className="form-error search-message" role="alert">{error}</p>}
      {message && <p className="search-message" role="status">{message}</p>}
      <div className="builder-actions"><button className="button" disabled={saving}>{saving ? "Saving..." : "Save options"}</button></div>
    </form>
  );
}

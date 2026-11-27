"use client";

import { useEffect, useRef } from "react";

export function useUnsavedChanges(dirty: boolean) {
  const removeWarning = useRef<() => void>(() => {});

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    removeWarning.current = () => window.removeEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      removeWarning.current = () => {};
    };
  }, [dirty]);

  return () => removeWarning.current();
}

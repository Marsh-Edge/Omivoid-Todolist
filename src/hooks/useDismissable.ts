"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Returns a ref for a popover container. While `open`, a pointer press
 * outside the container or an Escape key press calls `onDismiss`.
 * `onDismiss` should be stable (e.g. a `useState` setter or a `useCallback`).
 */
export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const node = ref.current;
      if (node && !node.contains(event.target as Node)) onDismiss();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onDismiss]);

  return ref;
}

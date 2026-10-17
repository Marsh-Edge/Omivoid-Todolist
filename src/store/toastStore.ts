import { create } from "zustand";

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 4000;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let counter = 0;

const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, variant = "info") => {
    const id = `${newId()}-${counter++}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Convenience helpers so callers don't import the raw store. */
export const toast = {
  info: (message: string) => useToastStore.getState().show(message, "info"),
  success: (message: string) => useToastStore.getState().show(message, "success"),
  error: (message: string) => useToastStore.getState().show(message, "error"),
};

export default useToastStore;

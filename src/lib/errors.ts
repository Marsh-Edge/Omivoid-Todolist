import { t } from "./i18n";
import { toast } from "@/store/toastStore";

/**
 * Friendly, i18n-ready user messages. Technical details are never shown in the
 * UI — only logged to the console for developers.
 */

/** Logs the technical error and returns a safe message for the UI. */
export function toUserMessage(
  error: unknown,
  fallback: string = t("errorGeneric"),
): string {
  console.error(error);
  return fallback;
}

/**
 * Logs the technical error and shows a friendly toast — for failures that have
 * no inline error slot (row actions, async fire-and-forget handlers).
 * Returns the same message so callers can reuse it.
 */
export function notifyError(
  error: unknown,
  fallback: string = t("errorGeneric"),
): string {
  const message = toUserMessage(error, fallback);
  toast.error(message);
  return message;
}

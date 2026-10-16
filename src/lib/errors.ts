import { t } from "./i18n";

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

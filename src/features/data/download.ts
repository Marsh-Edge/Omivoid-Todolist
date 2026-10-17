/**
 * Local file download helpers. The app is local-only, so "exporting" is just a
 * Blob + a synthetic anchor click — no server, no network.
 */

/** Filesystem-safe timestamp (`2026-10-18-14-30-00`) for export filenames. */
export function timestampSlug(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** Triggers a client-side download of `text` as `filename`. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

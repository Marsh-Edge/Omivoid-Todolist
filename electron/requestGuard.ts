/**
 * Production request / permission policy for the renderer session.
 *
 * Deliberately free of Electron imports so it can be unit tested; `main.ts`
 * wires these predicates into `webRequest` and permission handlers.
 */

/** The only permission the app uses: OS notifications for due tasks. */
const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set(["notifications"]);

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * True when a request may proceed. Only loopback http(s) is allowed — the app
 * is local-only, so anything that would leave the machine is cancelled.
 * Non-network schemes (`blob:`, `data:`, `devtools:`) pass: they never hit
 * the wire. `ws:`/`wss:` always imply a server, so they never pass.
 */
export function isAllowedRequest(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    return LOOPBACK_HOSTS.has(url.hostname);
  }
  if (url.protocol === "ws:" || url.protocol === "wss:") return false;
  return true;
}

/** True for the sole permission the app needs (due-task notifications). */
export function isAllowedPermission(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission);
}

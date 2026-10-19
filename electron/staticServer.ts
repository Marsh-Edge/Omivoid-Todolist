import { createHash } from "node:crypto";
import { createReadStream, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

/**
 * Loopback-only static file server for the packaged renderer.
 *
 * Extracted from `main.ts` so it can be tested without Electron (the tests
 * pass an ephemeral port and a temporary root directory). Never serves
 * anything remote: root is a local directory, requests stay on the given
 * loopback host.
 *
 * Response rules:
 * - existing files are served directly (hashed `/_next/static/` assets are
 *   immutable-cached, everything else is `no-store`),
 * - missing files with an extension (or any `/_next/` path) return 404 — a
 *   soft-404 that answers with `index.html` would be parsed as JS/CSS and
 *   produce confusing syntax errors,
 * - extensionless paths fall back to `index.html` (SPA routing),
 * - malformed percent-encoding returns 400 instead of crashing the handler,
 * - paths that resolve outside the root are never served (traversal guard),
 * - requests whose `Host` header is not this loopback origin are refused
 *   (DNS-rebinding guard: a remote page must not read the local app),
 * - every response carries `nosniff`, `Referrer-Policy`, framing/CORP and
 *   permissions lockdown headers, plus a strict CSP whose `script-src`
 *   carries SHA-256 hashes of the export's inline bootstrap scripts (no
 *   `'unsafe-inline'` for scripts).
 */

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  // Nothing about this app should ever be embedded or fetched cross-origin.
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  // The app needs no device features; deny them all explicitly.
  "Permissions-Policy":
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()",
} as const;

/** Everything except `script-src`, which depends on the export's inline hashes. */
const CSP_STATIC_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
] as const;

export function mimeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * SHA-256 hashes (CSP `script-src` source syntax) of every inline script in
 * the exported HTML files. `<script>` is a raw-text element, so the bytes
 * between the tags are exactly what the browser hashes. Computed once at
 * startup from a handful of files — no per-request cost.
 */
export function collectInlineScriptHashes(rootDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith(".html")) files.push(full);
    }
  };
  walk(rootDir);

  const hashes = new Set<string>();
  for (const file of files) {
    let html: string;
    try {
      html = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
      const body = match[1] ?? "";
      if (body.length === 0) continue;
      hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
    }
  }
  return [...hashes];
}

/**
 * Builds the renderer CSP. With hashes present, `script-src` is `'self'` plus
 * those hashes; without them (scanning failed) it falls back to
 * `'unsafe-inline'` so the app can never be bricked into a blank page.
 */
export function buildCsp(scriptHashes: readonly string[]): string {
  const scriptSrc =
    scriptHashes.length > 0
      ? `script-src 'self' ${scriptHashes.join(" ")}`
      : "script-src 'self' 'unsafe-inline'";
  return [...CSP_STATIC_DIRECTIVES, scriptSrc].join("; ");
}


/**
 * Resolves a request path to a file inside `rootDir`, or `null`.
 * Candidates: the exact path, `path.html`, and `path/index.html`.
 * Normalization + prefix check keep `../` traversal outside the root.
 */
export function resolveStaticFile(rootDir: string, requestPath: string): string | null {
  const candidates = [
    requestPath,
    requestPath.endsWith("/") ? `${requestPath}index.html` : `${requestPath}.html`,
    `${requestPath.replace(/\/$/, "")}/index.html`,
  ];

  for (const candidate of candidates) {
    const filePath = path.normalize(path.join(rootDir, candidate));
    const insideRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);
    if (!insideRoot) continue;
    try {
      if (statSync(filePath).isFile()) return filePath;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** True when the request names an asset — those 404 instead of SPA-falling-back. */
function looksLikeAsset(requestPath: string): boolean {
  return path.extname(requestPath) !== "" || requestPath.startsWith("/_next/");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Starts the server on `host` (loopback only) with the given `port`.
 * Pass `0` for an ephemeral port (tests); the actual bound port is reflected
 * in the returned `origin`.
 */
export async function startStaticServer(
  rootDir: string,
  port: number,
  host = "127.0.0.1",
): Promise<StaticServer> {
  const scriptHashes = collectInlineScriptHashes(rootDir);
  if (scriptHashes.length === 0) {
    console.error("[omivoid] no inline script hashes found; CSP falls back to 'unsafe-inline'");
  }
  const headers = { ...BASE_HEADERS, "Content-Security-Policy": buildCsp(scriptHashes) };

  // Filled in after listen(); requests can only arrive afterwards.
  let expectedHosts = new Set<string>();

  const server: Server = createServer((request, response) => {
    const requestHost = request.headers.host ?? "";
    if (!expectedHosts.has(requestHost)) {
      response.writeHead(403, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const url = request.url ?? "/";
    let requestPath: string;
    try {
      requestPath = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
    } catch {
      response.writeHead(400, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad Request");
      return;
    }

    const filePath = resolveStaticFile(rootDir, requestPath);
    if (filePath) {
      const isHashedAsset = requestPath.startsWith("/_next/static/");
      response.writeHead(200, {
        ...headers,
        "Content-Type": mimeFor(filePath),
        "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-store",
      });
      createReadStream(filePath)
        .on("error", (error) => {
          console.error("[omivoid] static file error", error);
          response.destroy();
        })
        .pipe(response);
      return;
    }

    if (looksLikeAsset(requestPath)) {
      response.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    // SPA fallback: extensionless paths render the app shell.
    const indexPath = path.join(rootDir, "index.html");
    response.writeHead(200, {
      ...headers,
      "Content-Type": mimeFor(indexPath),
      "Cache-Control": "no-store",
    });
    createReadStream(indexPath)
      .on("error", (error) => {
        console.error("[omivoid] static file error", error);
        response.destroy();
      })
      .pipe(response);
  });

  // Retry briefly: a previous instance may still be releasing the port.
  for (let attempt = 1; ; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        server.listen(port, host, () => {
          server.off("error", onError);
          resolve();
        });
      });
      break;
    } catch (error) {
      if (attempt >= 10) throw error;
      await delay(300);
    }
  }

  const address = server.address();
  const boundPort = typeof address === "object" && address !== null ? address.port : port;

  // Only requests addressed to this exact loopback origin are served; a page
  // from another origin reaching 127.0.0.1 (DNS rebinding) is refused above.
  expectedHosts = new Set([
    `${host}:${boundPort}`,
    `localhost:${boundPort}`,
    `[::1]:${boundPort}`,
  ]);

  return {
    origin: `http://${host}:${boundPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        // Idle keep-alive sockets (the renderer holds one for asset fetches)
        // would otherwise stall close() until the keep-alive timeout.
        server.closeIdleConnections?.();
        server.closeAllConnections?.();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

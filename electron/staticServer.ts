import { createReadStream, statSync } from "node:fs";
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
 * - every response carries `nosniff` and `Referrer-Policy: no-referrer`.
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
} as const;

export function mimeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
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
  const server: Server = createServer((request, response) => {
    const url = request.url ?? "/";
    let requestPath: string;
    try {
      requestPath = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
    } catch {
      response.writeHead(400, { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad Request");
      return;
    }

    const filePath = resolveStaticFile(rootDir, requestPath);
    if (filePath) {
      const isHashedAsset = requestPath.startsWith("/_next/static/");
      response.writeHead(200, {
        ...BASE_HEADERS,
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
      response.writeHead(404, { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    // SPA fallback: extensionless paths render the app shell.
    const indexPath = path.join(rootDir, "index.html");
    response.writeHead(200, {
      ...BASE_HEADERS,
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

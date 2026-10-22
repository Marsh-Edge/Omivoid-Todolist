import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Minimal, dependency-free static server for the exported web build (`out/`).
 *
 * This exists so the static export can be previewed in a normal browser —
 * exactly what the GitHub README screenshots are captured from. It mirrors the
 * Electron shell's loopback-only server: it binds to 127.0.0.1, never listens
 * on a public interface, and never talks to the network.
 *
 * Usage:
 *   npm run build && npm run serve
 *   npm run serve -- --port 41739 --dir out
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
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
  ".map": "application/json; charset=utf-8",
};

function parseArgs(argv) {
  const args = { port: 3000, dir: path.join(repoRoot, "out") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port" && argv[i + 1]) {
      args.port = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (argv[i] === "--dir" && argv[i + 1]) {
      args.dir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

const { port, dir: rootDir } = parseArgs(process.argv.slice(2));

if (!existsSync(rootDir)) {
  console.error(`Static export not found at ${rootDir} — run "npm run build" first.`);
  process.exit(1);
}

/**
 * Maps a request path to a file inside the export directory.
 * Returns null when the request escapes the root or nothing matches.
 */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const relative = decoded.replace(/^\/+/, "");
  const target = path.resolve(rootDir, relative);

  // Path traversal guard: everything served stays inside the export folder.
  if (target !== rootDir && !target.startsWith(rootDir + path.sep)) return null;

  if (existsSync(target) && statSync(target).isFile()) return target;

  // Next's static export writes "/stats" as "stats.html".
  const asHtml = `${target}.html`;
  if (existsSync(asHtml) && statSync(asHtml).isFile()) return asHtml;

  const asIndex = path.join(target, "index.html");
  if (existsSync(asIndex) && statSync(asIndex).isFile()) return asIndex;

  return null;
}

const server = http.createServer((request, response) => {
  const filePath = resolveFile(request.url ?? "/");

  if (!filePath) {
    const notFound = path.join(rootDir, "404.html");
    if (existsSync(notFound)) {
      response.writeHead(404, { "Content-Type": MIME_TYPES[".html"] });
      createReadStream(notFound).pipe(response);
      return;
    }
    response.writeHead(404, { "Content-Type": MIME_TYPES[".txt"] });
    response.end("Not found\n");
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[omivoid] static export served at http://127.0.0.1:${port} (${path.relative(repoRoot, rootDir)})`);
  console.log("[omivoid] loopback only — press Ctrl+C to stop.");
});

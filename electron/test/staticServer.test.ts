import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { get as httpGet, type OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mimeFor, resolveStaticFile, startStaticServer } from "../staticServer";

const INLINE_SCRIPT = 'console.log("inline-ok")';

interface Response {
  status: number;
  contentType: string | undefined;
  cacheControl: string | undefined;
  nosniff: string | undefined;
  csp: string | undefined;
  corp: string | undefined;
  frameOptions: string | undefined;
  permissionsPolicy: string | undefined;
  body: string;
}

describe("static server", () => {
  let root: string;
  let secretPath: string;
  let port = 0;
  let server: Awaited<ReturnType<typeof startStaticServer>> | null = null;
  const base = () => `http://127.0.0.1:${port}`;

  function get(pathname: string, headers: OutgoingHttpHeaders = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request = httpGet(base() + pathname, { headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            contentType: response.headers["content-type"],
            cacheControl: response.headers["cache-control"],
            nosniff: response.headers["x-content-type-options"],
            csp: response.headers["content-security-policy"],
            corp: response.headers["cross-origin-resource-policy"],
            frameOptions: response.headers["x-frame-options"],
            permissionsPolicy: response.headers["permissions-policy"],
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      });
      request.on("error", reject);
    });
  }

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "omivoid-static-"));
    mkdirSync(path.join(root, "_next", "static", "js"), { recursive: true });
    mkdirSync(path.join(root, "nested"), { recursive: true });
    writeFileSync(path.join(root, "index.html"), "<!doctype html><html>app shell</html>");
    writeFileSync(path.join(root, "style.css"), "body{color:red}");
    writeFileSync(path.join(root, "_next", "static", "js", "abc123.js"), "console.log(1)");
    writeFileSync(path.join(root, "nested", "page.html"), "<html>nested</html>");
    // An HTML page with an inline script — the CSP must hash it exactly.
    writeFileSync(
      path.join(root, "with-inline.html"),
      `<!doctype html><html><script>${INLINE_SCRIPT}</script>inline page</html>`,
    );
    // A real file OUTSIDE the root — a traversal bug would serve it.
    secretPath = path.join(tmpdir(), `omivoid-secret-${Date.now()}.txt`);
    writeFileSync(secretPath, "TOP SECRET");

    server = await startStaticServer(root, 0);
    port = Number(new URL(server.origin).port);
  });

  afterAll(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(secretPath, { force: true });
  });

  it("serves index.html at / with nosniff and no-store", async () => {
    const response = await get("/");
    expect(response.status).toBe(200);
    expect(response.contentType).toBe("text/html; charset=utf-8");
    expect(response.cacheControl).toBe("no-store");
    expect(response.nosniff).toBe("nosniff");
    expect(response.body).toContain("app shell");
  });

  it("serves hashed /_next assets with immutable caching", async () => {
    const response = await get("/_next/static/js/abc123.js");
    expect(response.status).toBe(200);
    expect(response.contentType).toBe("text/javascript; charset=utf-8");
    expect(response.cacheControl).toBe("public, max-age=31536000, immutable");
    expect(response.nosniff).toBe("nosniff");
    expect(response.body).toBe("console.log(1)");
  });

  it("maps .html to a nested pretty URL", async () => {
    const response = await get("/nested/page");
    expect(response.status).toBe(200);
    expect(response.body).toContain("nested");
  });

  it("falls back to the app shell for missing extensionless paths", async () => {
    const response = await get("/settings/deep/route");
    expect(response.status).toBe(200);
    expect(response.contentType).toBe("text/html; charset=utf-8");
    expect(response.body).toContain("app shell");
  });

  it("404s missing files with an extension (no soft-404 index.html)", async () => {
    const response = await get("/missing.css");
    expect(response.status).toBe(404);
    expect(response.body).toBe("Not Found");
  });

  it("404s missing /_next assets instead of serving HTML", async () => {
    const response = await get("/_next/static/js/gone.js");
    expect(response.status).toBe(404);
    expect(response.contentType).toBe("text/plain; charset=utf-8");
  });

  it("400s malformed percent-encoding instead of crashing", async () => {
    const response = await get("/%zz");
    expect(response.status).toBe(400);
    expect(response.nosniff).toBe("nosniff");
  });

  it("never serves files outside the root (traversal)", async () => {
    const secretName = path.basename(secretPath);
    const response = await get(`/..%2f..%2f${secretName}`);
    expect(response.status).toBe(404);
    expect(response.body).not.toContain("TOP SECRET");

    const direct = await get(`/${encodeURIComponent(`../../${secretName}`)}`);
    expect(direct.status).toBe(404);
    expect(direct.body).not.toContain("TOP SECRET");
  });

  it("sends a strict CSP whose script-src hashes the inline scripts", async () => {
    const response = await get("/");
    const expectedHash = `'sha256-${createHash("sha256").update(INLINE_SCRIPT).digest("base64")}'`;
    expect(response.csp).toBeDefined();
    expect(response.csp).toContain("script-src 'self'");
    expect(response.csp).toContain(expectedHash);
    expect(response.csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(response.csp).toContain("object-src 'none'");
    expect(response.csp).toContain("frame-ancestors 'none'");
    expect(response.csp).toContain("connect-src 'self'");
  });

  it("locks down framing, cross-origin reads and device features", async () => {
    const response = await get("/");
    expect(response.corp).toBe("same-origin");
    expect(response.frameOptions).toBe("DENY");
    expect(response.permissionsPolicy).toContain("camera=()");
    expect(response.permissionsPolicy).toContain("geolocation=()");
  });

  it("refuses requests addressed to another origin (DNS rebinding)", async () => {
    const response = await get("/", { Host: "evil.example" });
    expect(response.status).toBe(403);
    expect(response.csp).toBeDefined();
    expect(response.body).not.toContain("app shell");
  });

  it("closes cleanly", async () => {
    const ephemeral = await startStaticServer(root, 0);
    await expect(ephemeral.close()).resolves.toBeUndefined();
  });
});

describe("resolveStaticFile", () => {
  let root: string;
  let outside: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "omivoid-resolve-"));
    mkdirSync(path.join(root, "dir"), { recursive: true });
    writeFileSync(path.join(root, "a.html"), "<html>a</html>");
    writeFileSync(path.join(root, "dir", "index.html"), "<html>dir</html>");
    outside = path.join(tmpdir(), `omivoid-outside-${Date.now()}.txt`);
    writeFileSync(outside, "secret");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  });

  it("finds exact files, .html mappings, and directory indexes", () => {
    expect(resolveStaticFile(root, "/a.html")).toBe(path.join(root, "a.html"));
    expect(resolveStaticFile(root, "/a")).toBe(path.join(root, "a.html"));
    expect(resolveStaticFile(root, "/dir/")).toBe(path.join(root, "dir", "index.html"));
    expect(resolveStaticFile(root, "/nope")).toBeNull();
  });

  it("refuses paths that escape the root", () => {
    expect(resolveStaticFile(root, `/../${path.basename(outside)}`)).toBeNull();
    expect(resolveStaticFile(root, "/../../etc/passwd")).toBeNull();
  });
});

describe("mimeFor", () => {
  it("is case-insensitive and falls back to octet-stream", () => {
    expect(mimeFor("x.WoFF2")).toBe("font/woff2");
    expect(mimeFor("x.bin")).toBe("application/octet-stream");
  });
});

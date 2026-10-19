import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publishes SHA-256 checksums for the release installers so a download can be
 * verified independently of the (currently unsigned) binary.
 *
 * Usage: npm run release:checksums  →  release/SHA256SUMS.txt
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(repoRoot, "release");

const installers = readdirSync(releaseDir).filter((name) => /^.*setup\.exe$/i.test(name));
if (installers.length === 0) {
  console.error("No *-setup.exe artifacts found in release/ — run npm run electron:build first.");
  process.exit(1);
}

const lines = installers
  .sort()
  .map((name) => {
    const digest = createHash("sha256")
      .update(readFileSync(path.join(releaseDir, name)))
      .digest("hex");
    console.log(`${digest}  ${name}`);
    return `${digest}  ${name}`;
  });

const target = path.join(releaseDir, "SHA256SUMS.txt");
writeFileSync(target, `${lines.join("\n")}\n`, "utf8");
console.log(`\nWrote ${path.relative(repoRoot, target)}`);

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publishes SHA-256 checksums for the release artifacts so a download can be
 * verified independently of the (currently unsigned) binary.
 *
 * Usage:
 *   npm run release:checksums            → release/SHA256SUMS.txt
 *   npm run release:checksums -- --dir X → reads/writes inside X
 *
 * The output uses the `sha256sum` file format ("<digest>  <name>"), so it can
 * be verified with `sha256sum -c SHA256SUMS.txt` on Linux/macOS and with
 * `Get-FileHash` on Windows.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Installable artifacts worth publishing. Blockmaps and debug logs are not. */
const ARTIFACT_PATTERN = /\.(exe|AppImage|dmg|zip|tar\.gz)$/i;

function parseArgs(argv) {
  const args = { dir: path.join(repoRoot, "release") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir" && argv[i + 1]) {
      args.dir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

const { dir: releaseDir } = parseArgs(process.argv.slice(2));

const installers = readdirSync(releaseDir).filter((name) => ARTIFACT_PATTERN.test(name));
if (installers.length === 0) {
  console.error(
    `No release artifacts found in ${path.relative(repoRoot, releaseDir) || "."} — ` +
      "run npm run electron:build (or the release workflow) first.",
  );
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

// Gate: every new page under src/ must be listed in src/SUMMARY.md outside <!-- --> comments.
// mdBook builds only pages listed there, so an unlisted page silently disappears from the book.
// Usage: node dev/check-summary.mjs [base-ref]   (default: origin/develop)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";

const base = process.argv[2] ?? "origin/develop";

const added = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=A", `${base}...HEAD`, "--", "src/*.md", "src/**/*.md"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter((f) => f && f !== "src/SUMMARY.md");

const summary = readFileSync("src/SUMMARY.md", "utf8").replace(/<!--[\s\S]*?-->/g, "");
const listed = new Set(
  [...summary.matchAll(/\]\(([^)\s]+\.md)\)/g)].map((m) => posix.normalize(posix.join("src", m[1]))),
);

const missing = added.filter((f) => !listed.has(posix.normalize(f)));
if (missing.length > 0) {
  for (const f of missing) console.error(`::error file=${f}::${f} is not listed in src/SUMMARY.md (outside comments)`);
  process.exit(1);
}
console.log(`OK: ${added.length} new page(s), all listed in src/SUMMARY.md.`);

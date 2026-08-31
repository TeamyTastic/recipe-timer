const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const IGNORE_DIRS = new Set([".git", ".herenow", ".worktrees", "node_modules"]);
const IGNORE_FILES = new Set([".DS_Store"]);
const IGNORE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"]);
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk-(ant|proj)-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_FILES.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      if (IGNORE_DIRS.has(entry.name)) continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) yield* walk(fullPath);
    } else if (!IGNORE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      yield fullPath;
    }
  }
}

test("index.html has exactly one escapeHtml definition", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const matches = html.match(/function escapeHtml\b/g);
  assert.equal(
    matches ? matches.length : 0,
    1,
    `Expected 1 escapeHtml definition, found ${matches ? matches.length : 0}`,
  );
});

test("guideflow.html guards JSON.parse(activeGuide) with try/catch", () => {
  const html = fs.readFileSync(path.join(ROOT, "guideflow.html"), "utf8");
  // Find the block that parses activeGuide and assert it is inside a try/catch
  const parseIdx = html.indexOf("JSON.parse(activeGuide)");
  assert.ok(
    parseIdx !== -1,
    "JSON.parse(activeGuide) not found in guideflow.html",
  );
  // Scan backward for 'try {' within 200 chars before the parse call
  const before = html.slice(Math.max(0, parseIdx - 200), parseIdx);
  assert.ok(
    /try\s*\{/.test(before),
    "JSON.parse(activeGuide) must be inside a try block to guard against malformed storage data",
  );
});

test("repository does not contain high-confidence secret tokens", () => {
  const findings = [];

  for (const file of walk(ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(path.relative(ROOT, file));
      }
    }
  }

  assert.deepEqual(findings, []);
});

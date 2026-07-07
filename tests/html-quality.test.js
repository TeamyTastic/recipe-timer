const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const HTML = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

test("index.html defines escapeHtml exactly once (no silent override)", () => {
  const matches = HTML.match(/function escapeHtml\b/g) ?? [];
  assert.equal(
    matches.length,
    1,
    `Expected 1 escapeHtml definition, found ${matches.length} — duplicate silently overrides null/undefined handling`,
  );
});

test("index.html escapeHtml uses nullish coalescing for null/undefined safety", () => {
  // The safe version uses `value ?? ''` so null/undefined → '' not 'null'/'undefined'
  assert.ok(
    HTML.includes("String(value ?? '')"),
    "escapeHtml should use String(value ?? '') to safely handle null/undefined inputs",
  );
});

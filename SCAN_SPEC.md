# SCAN_SPEC.md — Nightly Scanner Guidance for recipe-timer

Authoring rules for the automated security scanner. Each entry eliminates a known confusion point so future scans don't hedge or guess.

---

## Focus

Security scanning priority order for this repo:
1. XSS via DOM injection (`innerHTML`, `outerHTML`, `insertAdjacentHTML`)
2. Untrusted data sources (LocalStorage, Gist API, Claude API responses)
3. Error message leakage into rendered HTML

---

## HTML Rendering Policy

**Rule:** `innerHTML` with any dynamic value is always a flag candidate — even when the source appears trusted.

This app uses plain-text titles, tags, and step descriptions. None of these fields are intended to contain HTML markup. If you see dynamic content injected via `innerHTML`, flag it unless the value has been explicitly passed through a sanitization function (e.g. `DOMPurify.sanitize()`). The absence of a sanitizer call is sufficient evidence to flag.

**Do NOT skip flagging** on the assumption that the data source (Claude API, Gist, LocalStorage) is "trusted" — all three are considered untrusted for DOM injection purposes in this app.

---

## Data Source Trust Classification

All three of the following sources are **untrusted** for DOM injection:

| Source | Reason |
|--------|--------|
| **LocalStorage** | An attacker or prior XSS payload could have written malicious values into storage across sessions. |
| **Gist API (`api.github.com/gists/...`)** | The Gist owner can edit it at any time; the scanner cannot verify intent at fetch time. |
| **Claude API responses** | Prompt injection could cause the model to return crafted HTML payloads in step titles or details. |

**Flag any `innerHTML` assignment** whose value traces back to one of these sources, even if the data looks benign in the current snapshot.

---

## Error Message Injection

**Rule:** `err.message` injected into `innerHTML` must always be flagged. Error messages originate from browser runtime, fetch failures, or third-party APIs — all outside developer control. Use `textContent` for error display.

Good: `el.textContent = err.message`
Bad: `` el.innerHTML = `<p>${err.message}</p>` ``

---

## Improvements (2026-05-22)

Added by nightly scanner self-improvement pass. One confusion point resolved:

1. **Duplicate function definitions** — Scanner was uncertain whether two definitions of `escapeHtml` in `index.html` were intentional (e.g. a polyfill pattern or deliberate override) or a mistake. Rule added: duplicate utility function definitions in the same file scope are always a flag. The later definition silently overrides the earlier one; flag at AUTOFIX 5/5 if the two implementations diverge (different null/undefined handling is sufficient evidence). Keep the definition with the broader null guard; remove the narrower one.

---

## Utility Function Deduplication Policy

**Rule:** Any utility function defined more than once in the same page/file scope is a flag — regardless of intent.

- If both definitions are identical → flag as redundant; remove the duplicate.
- If the definitions differ (e.g. one guards `null`/`undefined`, the other does not) → flag as a silent-override bug; keep the more defensive implementation and remove the other.
- Do NOT assume the developer intended the second definition to supersede the first. Silent overrides are a source of security regressions (e.g. a sanitizer with null-handling replaced by one without).

**Threshold**: AUTOFIX 5/5 when the correct definition is unambiguous (broader null guard wins). SKIP (1/5) only if both definitions have identical behaviour and neither is clearly "more correct."

---

## Improvements (2026-06-06)

Added by nightly scanner self-improvement pass. Two confusion points resolved:

1. **Null-guard universality** — Scanner was uncertain whether null/undefined guarding is a universal requirement for all string utilities in this codebase, or only expected in certain contexts. Rule added (see Sanitization Standards below): null guards are required on every HTML-escaping utility, regardless of call-site context. If a definition lacks a null guard, it is always weaker — even if current callers never pass null.

2. **Canonical sanitization** — Scanner lacked a clear rule about whether multiple `escapeHtml`-style functions could legitimately coexist (e.g. one for attributes, one for text nodes). Rule added: this repo has one DOM context (plain text fields) and therefore one canonical `escapeHtml` is correct. Multiple implementations in the same file scope are always a deduplication target — not a sign of intentional specialization — unless they are named differently (e.g. `escapeAttr` vs `escapeHtml`).

---

## Sanitization Standards

**Rule: null/undefined guards are required on all HTML-escaping utilities.**

`String(value)` coercion (which handles `null` → `"null"` and `undefined` → `"undefined"`) must wrap the input before any `.replace()` chain. A definition that calls `.replace()` directly on the argument will throw if the caller ever passes `null` or `undefined`.

Good: `return String(str).replace(...)`
Bad:  `return str.replace(...)`

**Threshold for missing null guard**: AUTOFIX 5/5 — add `String()` coercion to the existing definition in-place; do not introduce a second definition.

**Rule: one canonical escapeHtml per file scope.**

This app has one DOM context (plain text content). One implementation is correct. If two functions share the same name but differ only in null-guard presence, the broader one is the canonical form. If two functions have *different* names (e.g. `escapeHtml` vs `escapeForAttribute`), they may coexist — but flag if their implementations diverge unexpectedly.

---

## Improvements (2026-06-23)

Added by nightly scanner self-improvement pass. Two confusion points resolved:

1. **SCAN_SPEC.md rules override generic uncertainty** — When this file already documents a specific threshold for a specific pattern, apply that threshold directly. Do NOT downgrade (e.g. from AUTOFIX 5/5 to GATED 3/5) because of general uncertainty about developer intent. The purpose of SCAN_SPEC.md is to eliminate guessing — if the rule is here, the decision is already made. Hedging against an explicit rule is a scanning error, not caution.

2. **Single-file app architecture is intentional** — `index.html` contains all JS for this app. This is deliberate architecture, not disorganisation. Do NOT flag utility functions as "should be moved to a dedicated JS module" — function placement is not a finding in this repo. The only valid findings about utility functions are: (a) duplicate definitions (already covered above), (b) missing null guards (already covered above), (c) direct security issues in the implementation.

---

## Improvements (2026-07-07)

Added by nightly scanner self-improvement pass. Three confusion points resolved:

1. **`String(value ?? '')` is the canonical null guard for this app** — The existing Sanitization Standards section uses `String(str)` as its example, which converts `null` → `"null"` and `undefined` → `"undefined"`. This app renders values into DOM text: injecting the literal string "null" is a UX defect, not a safe outcome. The preferred form is `String(value ?? '')`, which produces an empty string for null/undefined. Recognize `String(value ?? '')` as fully compliant with the null-guard requirement — it is strictly preferable. Do NOT flag it as a deviation or express uncertainty about whether the `??` coercion adds value.

2. **Check SCAN_SPEC.md before writing a confusion note** — If your Phase F reflection proposes a SCAN_SPEC.md amendment, first verify the amendment isn't already present. If it is already present (same rule, same threshold), the confusion is a reading failure, not a documentation gap. The correct output in that case is: "No new amendments needed — existing rule at [section] already covers this." Do not repeat existing rules back as proposed additions; that creates noise and obscures genuinely missing coverage.

3. **Confusion about already-settled patterns is a scanning error** — The 2026-06-23 improvements established that SCAN_SPEC.md rules override generic uncertainty. This extends to the reflection phase: if a confusion point would be resolved by reading an existing SCAN_SPEC.md rule, cite the rule and close the confusion. Do not carry it forward as an open question. Open questions in the reflection should only be things genuinely not covered by this file.

---

## Improvements (2026-08-07)

Added by nightly scanner self-improvement pass. Three confusion points resolved:

1. **CORS proxy URL validation consistency** — Scanner was uncertain whether `isSafeUrl()` is a globally available utility or a file-scoped function, making it hard to judge whether its absence in `guideflow.html` was a security gap or an intentional design difference. Rule added (see CORS Proxy Safety below): any user-supplied URL passed to an external proxy must be validated before encoding. If `index.html` validates the same input pattern with `isSafeUrl()`, the equivalent code path in `guideflow.html` must also validate it. Inconsistency between files is sufficient evidence to flag at REVIEW 2/5 — do NOT assume guideflow.html has a different policy without explicit documentation to that effect.

2. **localStorage JSON.parse error handling** — Scanner was unsure whether `try-catch` around `JSON.parse` and a fallback to default state is universally required or only expected in some contexts. Rule added (see localStorage Error Handling below): every `JSON.parse()` on a localStorage value must be wrapped in `try-catch`. The absence of a try-catch is always a finding at AUTOFIX 4/5 — no ambiguity about developer intent applies here. The correct fallback is to clear the corrupted key and continue with a safe default.

3. **Severity scoring for uncaught parse/runtime errors** — Scanner hedged between Minor and Moderate when scoring an unrecoverable `JSON.parse` throw in `window.onload`. Rule added (see Issue Severity: Parse Errors below): a page-bricking uncaught exception that has no security impact and causes no data loss scores AUTOFIX 4/5 (Minor). It is not Moderate unless there is an active exploit path (e.g. an attacker can force-write the corrupted value to trigger a denial-of-service). **Superseded 2026-08-26**: this AUTOFIX 4/5 floor does not apply when the throw is in `window.onload` or any top-level handler that initialises the whole page — see Issue Severity: Parse Errors below, which now scores that specific case CRITICAL.

---

## CORS Proxy Safety

**Rule:** Any user-supplied URL passed to an external CORS proxy must be validated before being encoded and fetched.

This app uses `https://api.allorigins.win/raw?url=...` as a CORS proxy. User input passed to this proxy without validation allows SSRF-adjacent abuse (fetching internal URLs, file:// URIs, localhost endpoints) and enables open-redirect-style phishing.

- If a URL validation utility (e.g. `isSafeUrl()`) exists anywhere in the codebase, its use must be consistent across **all** files that accept external URLs from users.
- If `index.html` calls `isSafeUrl(urlInput)` before the proxy fetch and `guideflow.html` does not, that inconsistency is a finding at **REVIEW 2/5** regardless of whether `guideflow.html` has access to the function in its current scope.
- Do NOT lower the severity because the proxy is an external service — the risk is what the proxy fetches on the user's behalf, not the proxy vendor itself.

Good: `if (!isSafeUrl(urlInput)) { showError('Invalid URL'); return; }`
Bad: `const proxyUrl = \`https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput)}\`;` (no prior validation)

---

## localStorage Error Handling

**Rule:** Every `JSON.parse()` call on a localStorage value must be wrapped in `try-catch`.

Corrupt or attacker-written localStorage values will throw a `SyntaxError` from `JSON.parse`. If this throw is uncaught inside `window.onload` or any initialisation path, it permanently bricks the page for that user — the only recovery is manual DevTools intervention to clear storage.

Correct pattern:
```js
try {
  const data = JSON.parse(activeRecipe);
  // ... use data
} catch (e) {
  localStorage.removeItem('activeRecipe');
  loadCachedRecipes(); // or equivalent safe default
}
```

- **Threshold**: AUTOFIX 4/5 — wrapping in try-catch with a safe fallback is unambiguous and has no architectural implications.
- The fallback must clear the corrupted key (prevent infinite re-throw on next load) and invoke the safe initialisation path (e.g. `loadCachedRecipes()`, empty state, etc.).
- Apply this rule to every file in the repo, not just `index.html`. `guideflow.html` and any future pages are subject to the same requirement.

---

## Issue Severity: Parse Errors and Runtime Crashes

**Superseded 2026-08-26** — see rule 3 under Improvements (2026-08-26) below for the current standard. Scope, not just recoverability, decides severity now.

**Rule:** Severity for an uncaught parse/runtime exception depends on blast radius, not just security impact:

- If the throw is inside `window.onload` or any handler that initialises the entire page, the blast radius is total (the page never initialises) — score **CRITICAL (5/5)**, regardless of whether DevTools can manually recover it.
- If the throw is inside a narrower handler that gracefully skips on error and the rest of the page still loads, score **AUTOFIX 4/5 (Minor)**.

| Condition | Score |
|-----------|-------|
| Uncaught parse error in `window.onload` / top-level init → page never loads | CRITICAL 5/5 |
| Uncaught parse error in a narrower handler → rest of page still loads | AUTOFIX 4/5 |
| Uncaught parse error + attacker can write the malformed value (stored XSS vector) | Moderate REVIEW 2–3/5 |
| Uncaught parse error + data permanently lost with no recovery | Moderate REVIEW 2–3/5 |
| Uncaught parse error + active SSRF / credential leak possible | Critical — flag immediately |

The localStorage `JSON.parse` case in this app, when it throws inside `window.onload`, scores CRITICAL 5/5: "can be manually recovered via DevTools" is not a recovery path available to a non-developer end user, so it does not reduce severity below CRITICAL.

---

## Improvements (2026-08-26)

Added by nightly scanner self-improvement pass. Three confusion points resolved:

1. **Page lockout = CRITICAL, not MODERATE** — A silent crash in `window.onload` (or equivalent top-level handler) that leaves the page blank or non-interactive with no visible error is CRITICAL. "Users can manually recover via DevTools" does not make it MODERATE — that bar requires a recoverable path available to a non-developer end user (e.g. a visible "clear data" button, a reload prompt, or a fallback UI). If the only recovery is opening DevTools and deleting a localStorage key, treat it as CRITICAL.

2. **JSON.parse on localStorage data always requires try/catch** — Any `JSON.parse` call whose input comes from `localStorage.getItem()` is a flag candidate. Corrupted storage (browser crash, storage quota exceeded, prior XSS write) is a realistic failure mode, not a theoretical one. The correct recovery for this app is: `catch` the error, remove the offending key (`localStorage.removeItem(key)`), and fall through to default/empty state. Do NOT flag this as low-priority due to perceived storage reliability — flag it at AUTOFIX 4/5 (or CRITICAL 5/5 if it crashes a top-level load handler).

3. **Severity for JSON.parse crashes: correlate scope, not just recoverability** — When a JSON.parse failure is inside `window.onload` or any handler that initialises the entire page, classify it as CRITICAL (5/5) because the blast radius is total (the page never initialises). When the parse is in a narrower handler (e.g. a single feature's init that gracefully skips on error), AUTOFIX 4/5 is appropriate. The question to ask: "If this throws, does the rest of the page still load?" No → CRITICAL. Yes → AUTOFIX.

---

## Improvements (2026-04-29)

Added by nightly scanner self-improvement pass. Three confusion points resolved:

1. **innerHTML intent ambiguity** — Scanner was uncertain whether dynamic `innerHTML` was intentional rich-HTML rendering or accidental. Rule added: plain-text fields (titles, tags, steps) are never intended as HTML; flag all dynamic `innerHTML` without a sanitizer.

2. **Data source trust scope** — Scanner hedged on whether Gist/LocalStorage/Claude API were "trusted enough" to skip flagging. Rule added: all three are explicitly untrusted for DOM injection; no source exemption applies.

3. **Error message safety** — Scanner was unsure whether `err.message` needed handling given surrounding context. Rule added: `err.message` in `innerHTML` is always a flag; use `textContent` unconditionally.

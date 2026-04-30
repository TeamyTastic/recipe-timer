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

## Improvements (2026-04-29)

Added by nightly scanner self-improvement pass. Three confusion points resolved:

1. **innerHTML intent ambiguity** — Scanner was uncertain whether dynamic `innerHTML` was intentional rich-HTML rendering or accidental. Rule added: plain-text fields (titles, tags, steps) are never intended as HTML; flag all dynamic `innerHTML` without a sanitizer.

2. **Data source trust scope** — Scanner hedged on whether Gist/LocalStorage/Claude API were "trusted enough" to skip flagging. Rule added: all three are explicitly untrusted for DOM injection; no source exemption applies.

3. **Error message safety** — Scanner was unsure whether `err.message` needed handling given surrounding context. Rule added: `err.message` in `innerHTML` is always a flag; use `textContent` unconditionally.

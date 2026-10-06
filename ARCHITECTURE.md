# Jobsmith — Architecture Note (v0, pending approval)

This note is the plan for building Jobsmith. No application code is written yet.
Per the brief, I'll stop after each phase, run tests, and summarize before continuing.

## 1. Toolchain: WXT (not CRXJS)

**Decision: WXT.**

| | WXT | CRXJS |
|---|---|---|
| Manifest generation | Convention-based, typed, generates MV3 manifest from `entrypoints/` folder structure | Manual `manifest.json` + Vite plugin fills in build artifacts |
| Multi-entrypoint DX (options, side panel, background, multiple content scripts) | First-class, file-based routing, auto-imports | Supported but more manual wiring |
| Side panel support | Built-in entrypoint type | Supported, less documented |
| HMR for content scripts / background | Mature | Experimental/flaky historically |
| Maintenance status | Actively developed, frequent releases | Maintenance has been slower in the last period |
| Chrome Web Store packaging / zip | Built-in (`wxt zip`) | Manual |
| Cross-browser (future Firefox port) | Built-in abstraction | Not addressed |

Given Jobsmith has 4 real entrypoints (background/service worker, content script(s), options page, side panel) plus a strict MV3 manifest with permissions we want to keep minimal and well-documented, WXT's typed manifest config and entrypoint conventions reduce boilerplate and risk of manifest drift. CRXJS is lighter but we'd hand-roll what WXT gives us for free, and its content-script HMR has been less reliable.

Stack on top of WXT: React + TypeScript, Tailwind (for options + side panel only; content script UI stays unstyled/scoped to avoid leaking Tailwind resets into host pages), Vitest, Playwright, Dexie, Zod.

## 2. Project layout

```
jobsmith/
  wxt.config.ts
  package.json / tsconfig.json / tailwind.config.ts
  entrypoints/
    background.ts            # service worker: LLM calls, caching, message routing
    content/
      index.ts                # registers per-ATS content scripts (see adapters)
      ui.tsx                  # injected "Fill" button + inline save-answer prompt (shadow DOM)
    options/
      index.html, main.tsx, App.tsx
    sidepanel/
      index.html, main.tsx, App.tsx
  src/
    schemas/                  # Zod schemas, one file per entity, all versioned
      profile.ts  preferences.ts  documents.ts  answerBank.ts
      sensitiveDefaults.ts  companyCache.ts  applications.ts  settings.ts
      migrations/            # versioned migration functions per store
    storage/
      localStore.ts           # typed chrome.storage.local wrapper (get/set/subscribe + migration runner)
      db.ts                   # Dexie schema + versioned upgrade() chain
      crypto.ts               # AES-GCM + key derivation for sensitive values
    llm/
      client.ts               # OpenAI wrapper: retries, timeout, token accounting, Zod-validated JSON
      models.ts                # configurable model IDs + defaults, no hard-coding in call sites
      prompts/                 # parseProfile, mapFields, draftAnswer, verifyAnswer, companyBrief
    autofill/
      detect.ts                # field discovery (label, aria, name/id, autocomplete, options)
      heuristics.ts            # Layer 1: synonym-list matching
      llmMapping.ts            # Layer 2: LLM fallback (labels/types/options only, no values)
      setValue.ts              # native setter + input/change/blur dispatch; select/radio/checkbox/date/file
      sensitiveFields.ts        # detection + per-category default behavior
      adapters/
        base.ts  greenhouse.ts  lever.ts  ashby.ts  smartrecruiters.ts  workday.ts
    answerBank/
      matching.ts               # normalize + local fuzzy match (see open question #3)
      store.ts
    jd/extractJobDescription.ts  # JSON-LD JobPosting -> heuristics -> ask user
    company/companyBrief.ts       # cache -> OpenAI web search -> About-page fetch -> ask user
    messaging/types.ts + bus.ts   # typed message contract: content <-> background <-> sidepanel
    ui/components/                # shared Tailwind components (options + side panel)
  tests/
    unit/                         # Vitest: schemas, matching, heuristics, llm client, crypto
    fixtures/html/{greenhouse,lever,ashby,smartrecruiters,workday}/*.html
    e2e/                          # Playwright, loads unpacked built extension against fixtures
  public/icons/
  README.md
  PRIVACY.md
```

## 3. Storage split

- **`chrome.storage.local`**: `Settings`, `Profile`, `Preferences`, `SensitiveDefaults` (+ encrypted sensitive values blob). These are singletons, small, and benefit from `chrome.storage.onChanged` for cross-surface sync (options ↔ side panel ↔ background).
- **Dexie (IndexedDB)**: `Documents` (CV/cover-letter blobs + parsed text — large), `AnswerBank[]`, `CompanyCache[]`, `Applications[]` — these are append-heavy collections that benefit from indexing/querying.
- Every store has a `schemaVersion` field; a migration runner walks `v(n) -> v(n+1)` functions on load. Zod validates on every read and write; failed validation never silently drops data — it surfaces an error state.

## 4. Message bus

Single typed envelope `{ type, requestId, payload }` validated with Zod discriminated unions, shared by content script, side panel, and background via `chrome.runtime.sendMessage`/`onMessage` and `chrome.runtime.connect` for the longer-lived side-panel session. No surface reaches into another's storage directly except through this contract — keeps the "never auto-submit" and "sensitive fields never leave the device" invariants enforceable in one place (background mediates every LLM call and can hard-block sensitive payloads at that boundary).

## 5. Autofill engine

Three layers as specified. Layer 3 adapters implement a common interface (`detect(): Field[]`, `quirks` hooks for custom dropdowns/date pickers) so Greenhouse/Lever ship first and Ashby/SmartRecruiters/Workday slot into the same interface later. A hard-coded hostname denylist (LinkedIn + known Easy-Apply domains) is checked *before* any content script logic runs, independent of whatever host permissions were granted — belt-and-suspenders against the "never automate LinkedIn" rule.

Value setting uses the native-setter + event-dispatch trick (`Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set`) for React/Angular compatibility, confidence-scored dropdown matching (exact → alias → LLM fuzzy, never silent-guess on low confidence), and an in-memory undo stack per fill session.

## 6. LLM module

One `llm/client.ts` wrapper used by every prompt: timeout + bounded retries with backoff, max-token guards, strict Zod parse of the JSON response (reject and retry-once-with-correction on failure), and a running token/cost estimate shown in the Settings → AI tab. Model IDs are plain configurable strings (`settings.models.parse`, `settings.models.answer`, `settings.models.answerBetter`) with defaults set in `src/llm/models.ts`, never inlined at call sites.

> Note on defaults: a web search today returned OpenAI's current lineup as `gpt-6-luna` (cheapest/mini-class, structured outputs supported) and `gpt-6.1-sol` (stronger, lower cost than flagship) as of the model catalog at build time. I'll wire these in as the defaults for "standard" and "better quality" respectively, but since this is the kind of fact that goes stale fast and you can change it in one place, flag if you want different literal defaults.

Sensitive-field values are filtered out *before* any payload is constructed for the LLM — not redacted after construction. A unit test asserts no outgoing `fetch` to `api.openai.com` ever contains a sensitive-category value or label-adjacent raw string from the sensitive set, run against the request objects (not live network) in CI.

## 7. Permissions model

Manifest requests only `storage`, `scripting`, `sidePanel`, `activeTab`, plus `host_permissions` for `https://api.openai.com/*` (required for the extension to function at all, touches no browsing data). All ATS site access is **optional** (`optional_host_permissions`), granted per-origin on demand — see open question #4 for the exact on-ramp UX. The README will enumerate exactly what each permission is for and what is never requested (no `<all_urls>`, no `tabs`, no `webRequest`).

## 8. Testing strategy

- **Vitest**: schemas + migrations, matching/fuzzy logic, heuristics synonym tables, LLM client (mocked fetch), crypto round-trip, sensitive-field filter (the "never sent to LLM" guarantee).
- **Playwright**: loads the built unpacked extension into a persistent Chromium context, opens local HTML fixtures (saved real markup from Greenhouse/Lever/etc. test or demo postings — not live scraping during tests), and asserts fill rates per the ≥90% acceptance criterion. See open question #5 on sourcing fixtures.

## 9. Phases (unchanged from brief, restated for sign-off)

1. Foundation — scaffold, schemas + storage layer, options shell, API key settings, export/import.
2. CV onboarding — upload, extraction, LLM parse, review screen, preferences wizard.
3. Autofill core — layers 1–2, filling logic, Greenhouse + Lever adapters, fixtures + tests.
4. Learning — save-answer prompt, answer bank, fuzzy matching, answer bank UI.
5. AI answers — JD extraction + paste fallback, company brief + cache, ask-then-polish, variants, verification pass, side panel UI.
6. Sensitive fields + dropdown robustness — defaults, optional encryption, custom dropdowns.
7. More ATS + hardening — Ashby, SmartRecruiters, Workday, file upload, errors, a11y, README, privacy policy, store checklist.

I'll stop after each phase for review and tests before moving on.

## 10. Open questions (need your call before I start Phase 1)

1. **Sensitive-value encryption primitive**: PBKDF2-SHA256 (native Web Crypto, zero extra bundle size) vs Argon2id (stronger, needs a ~100KB+ WASM dependency). I'd default to PBKDF2 with a high iteration count unless you want Argon2.
2. **Answer-bank fuzzy matching**: start local-only (normalized text + a lightweight string-similarity algorithm, no network call) for Phase 4, and treat OpenAI embeddings as a later "better quality" opt-in — or do you want embeddings from day one?
3. **Host-permission UX**: (a) ship with the 5 known ATS domains pre-listed as one-click toggles in Options → Sites (each toggle calls `chrome.permissions.request` for just that origin, off by default), or (b) rely purely on `activeTab` + an in-page "Enable Jobsmith on this site?" prompt the first time the content script's manifest-declared matches don't cover the current host. (a) is more discoverable, (b) is more minimal/ad hoc.
4. **Test fixtures**: for Phase 3 I'd like to capture a couple of real, public Greenhouse and Lever job-posting pages (view-only, no form submission) as static HTML fixtures via the browser tool. OK to do that, or do you have fixtures/sites you'd prefer I use instead?
5. **Default model names**: confirm you're fine with the defaults noted in §6 (or give me the exact strings you want), given model catalogs change over time.

Once you confirm/adjust the above, I'll start Phase 1.

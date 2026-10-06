# Jobsmith — Architecture Note

This note was the plan for building Jobsmith. All seven phases below are now implemented, built straight through at the owner's explicit request (rather than stopping for review after each phase, which is how work started and how §9 originally read). §11 records where the implementation differs from this plan.

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
      crypto.ts               # AES-GCM; passphrase key via PBKDF2-SHA256 (high iteration count)
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
      matching.ts               # normalize + local string similarity; embeddings later, opt-in
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

**Decision: model defaults.** Everyday parsing, field mapping, and answers use `gpt-6-luna`. The "better quality" toggle uses `gpt-6.1-sol`. Both are settings strings, so a later model (including `gpt-4o-mini`) can be typed in without a code change. Checked against OpenAI's catalog on 6 Oct 2026: `gpt-6-luna` is the current cheap model with structured outputs; `gpt-4o-mini` still works on the API but is an older, weaker default.

Sensitive-field values are filtered out *before* any payload is constructed for the LLM — not redacted after construction. A unit test asserts no outgoing `fetch` to `api.openai.com` ever contains a sensitive-category value or label-adjacent raw string from the sensitive set, run against the request objects (not live network) in CI.

## 7. Permissions model

Manifest requests only `storage`, `scripting`, `sidePanel`, `activeTab`, plus `host_permissions` for `https://api.openai.com/*` (required for the extension to function at all, touches no browsing data). Site access is **optional** and granted per-origin on demand. Chrome will only show a runtime prompt for an origin that `optional_host_permissions` already covers, so that list contains `<all_urls>`. The extension does not request `<all_urls>` itself, and nothing is granted at install. There is no `tabs` or `webRequest` permission. The LinkedIn denylist still applies after a grant.

**Decision: five toggles, plus a per-site enable for everything else.**

- **Known ATS platforms.** Options → Sites lists Greenhouse, Lever, Ashby, SmartRecruiters, and Workday. Each toggle is off by default and calls `chrome.permissions.request` for that origin pattern only (for example `https://*.greenhouse.io/*`). Once granted, the grant persists, so the user does not re-approve on every visit. These sites get layers 1–3, including the platform adapter.
- **Any other company career page.** A separate "Enable Jobsmith on this site" action (side panel or toolbar click) calls `chrome.permissions.request` for the current tab's origin only. That site runs on layers 1 and 2 (heuristics + LLM field mapping). There is no platform adapter. The LinkedIn / Easy-Apply hostname denylist still applies and cannot be overridden by a grant.
- The README enumerates every permission. `tabs` and `webRequest` are not requested. `<all_urls>` is listed only as an optional host pattern so a single site can be approved later; it is not granted up front.

## 8. Testing strategy

- **Vitest**: schemas + migrations, matching/fuzzy logic, heuristics synonym tables, LLM client (mocked fetch), crypto round-trip, sensitive-field filter (the "never sent to LLM" guarantee).
- **Playwright**: loads the built unpacked extension into a persistent Chromium context, opens local HTML fixtures, and asserts fill rates per the ≥90% acceptance criterion. Fixtures are saved copies of public Greenhouse and Lever application pages, captured view-only in Phase 3. Tests never hit the live sites and never submit a form.

## 9. Phases (unchanged from brief, restated for sign-off)

1. Foundation — scaffold, schemas + storage layer, options shell, API key settings, export/import. **Done.**
2. CV onboarding — upload, extraction, LLM parse, review screen, preferences wizard. **Done.**
3. Autofill core — layers 1–2, filling logic, Greenhouse + Lever adapters, fixtures + tests. **Done, including Layer 2.**
4. Learning — save-answer prompt, answer bank, fuzzy matching, answer bank UI. **Done.**
5. AI answers — JD extraction + paste fallback, company brief + cache, ask-then-polish, variants, verification pass, side panel UI. **Done.**
6. Sensitive fields + dropdown robustness — defaults, optional encryption, custom dropdowns. **Done — custom dropdown handling covers the ARIA combobox pattern (Workday); see §11 for how it was built and verified.**
7. More ATS + hardening — Ashby, SmartRecruiters, Workday, file upload, errors, a11y, README, privacy policy, store checklist. **Adapters registered and file-upload attach done; privacy policy draft and store checklist not done.**

Phases 2–7 were built in one continuous pass rather than stopping after each one, at the owner's explicit instruction given after Phase 1 shipped. See §11 for every place the result differs from what was planned here.

## 10. Decisions

### Decided

1. **Sensitive-value encryption: PBKDF2-SHA256.** Native Web Crypto, no extra dependency. High iteration count (current OWASP guidance for SHA-256, at least 600,000). AES-GCM encrypts the saved sensitive values. Argon2id is not used.
2. **Known ATS sites: five toggles, not a blanket grant.** Options → Sites lists Greenhouse, Lever, Ashby, SmartRecruiters, and Workday. Each is off by default and requests only that origin pattern. `<all_urls>` is an optional manifest pattern so other sites can be enabled one at a time; it is never the permission that gets requested.
3. **Other sites still work, without an adapter.** "Enable Jobsmith on this site" requests permission for the current tab's origin only. Fill uses layers 1 and 2. The LinkedIn / Easy-Apply denylist still blocks those hosts. See §7.
4. **Answer-bank matching is local-only in Phase 4.** Normalize the question text, then score it with a lightweight string-similarity algorithm. No network call and no OpenAI embeddings on the default path. Embeddings can be added later as an opt-in under the "better quality" setting.
5. **Test fixtures come from public postings.** In Phase 3, capture a couple of real public Greenhouse and Lever application pages as static HTML (view-only, no form submission). Playwright runs against those saved files, not the live sites.
6. **Default models.** `gpt-6-luna` for parsing, field mapping, and answers. `gpt-6.1-sol` when "better quality" is on. Both are editable in AI settings. See §6.

## 11. Where the build differs from this note

Phases 2–7 were built in one continuous pass at the owner's request, rather than stopping for review after each one. Two decisions above (§10.5 and the Playwright line in §8) were not followed as written, and two features were built but not fully wired up. All are tracked here rather than silently left out of this note:

- **§10.5 / §8, test fixtures and Playwright.** The fixtures under `tests/fixtures/html/{greenhouse,lever}/` are hand-authored markup representative of each platform's typical field structure, not captured from a live posting. Playwright was never added as a dependency; `src/autofill/fillFixtures.test.ts` runs the same ≥90% fill-rate and non-overwrite assertions with Vitest + jsdom against those fixtures instead, loading the fixture HTML into the ambient jsdom `document` (not a separate `JSDOM` instance) so `instanceof HTMLInputElement`-style checks in `detect.ts` see the same realm. This is a real gap against the plan: no test here exercises a real browser or the built extension end to end, and the fixtures may not reflect how live Greenhouse/Lever pages are actually marked up today.
- **Layer 2 (LLM field-mapping fallback), `src/llm/prompts/mapFields.ts`, is now wired into the live fill flow.** After Layer 1 heuristics and the answer-bank lookup, the content script sends whatever's still unmatched (excluding textareas and file inputs, which are handled elsewhere) to the background via a `map-fields` message; the background is the only place that holds the API key and makes the call. Only mappings the model marked `confident: true` are applied, and they go through the same `fillFields`/dropdown-matching path as Layer 1, so a select or radio field still only fills on an exact or alias match. If there's no API key set, the step is skipped silently and the field stays reported as unmatched — filling still works end to end without AI configured.
- **Sensitive-value encryption, now with a passphrase UI.** `src/storage/crypto.ts` implements PBKDF2-SHA256 (600,000 iterations) + AES-GCM via native Web Crypto, as decided in §10.1. Options → Sensitive has a "Protect saved values with a passphrase" control: turning it on asks for a new passphrase (min 8 characters, typed twice), encrypts every `use_saved_answer` category's value with it, and caches the passphrase in `chrome.storage.session` (`src/storage/sessionPassphrase.ts`) — scoped to this browser session only, never written to `chrome.storage.local`/Dexie, never synced, gone when the browser closes. Re-opening Options later shows an "Unlock" prompt instead of the raw ciphertext if the session cache is empty (browser restarted) or re-decrypts automatically if it's still there. The content script decrypts at fill time the same way, through `src/autofill/decryptSensitiveDefaults.ts`; a category whose session passphrase is missing or wrong falls back to "ask every time" for that fill rather than failing the whole fill or guessing. `chrome.storage.session` is extension-pages-only by default, so the background calls `chrome.storage.session.setAccessLevel({accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"})` on startup to let the content script read the cached passphrase too; the OpenAI API key is never put in session storage and is only ever read in the background. `SensitiveDefaults` moved to schema version 2 (added an `encrypted` flag per category) with a migration for existing version-1 records.
- **Ashby/SmartRecruiters adapters.** Both register in `src/autofill/adapters/registry.ts` by hostname but have no quirk-handling body yet — they fall through to the generic adapter.
- **Workday custom widgets, `src/autofill/workdayWidgets.ts`.** When the Workday adapter is active, the content script runs a second pass over the live DOM (outside `detectFields`/`fillFields`, since these widgets aren't native form controls) for two patterns: ARIA combobox buttons (click → wait for a `role="listbox"` to appear, via `aria-controls` or a `MutationObserver` — → match an option by text through the same `matchDropdownOption` used for native `<select>` → click it) and three-input Month/Day/Year groups (matched to a profile key by their legend/label text, filled only when that key is `preferences.startDate`). Both skip entirely, before opening or reading anything, if the group's label text matches a sensitive category — the same `isSensitiveLabel` check `sensitiveFields.ts` uses elsewhere. This is written from the publicly documented ARIA combobox pattern, not from a captured Workday page, and has not been checked against one; `src/autofill/workdayWidgets.test.ts` covers the logic against a hand-built fixture, same caveat as the Greenhouse/Lever fixtures in the first bullet. There's no undo path for either widget type yet.
- **Sensitive-field guarantee, now that Layer 2 is live.** `src/autofill/sensitiveFields.ts` detects gender/ethnicity/disability/veteran/sexual-orientation/religion/date-of-birth categories by label/option text and the content script removes them from the field list *before* heuristics, the answer bank, or `fieldsForMapping` ever see them (`src/autofill/applySensitiveDefaults.ts` handles them separately, with no network call). So a sensitive field can never become part of the "still unmatched" set that gets sent to Layer 2 — it never reaches `fieldsForMapping`, let alone the model. `src/autofill/sensitiveNeverSent.test.ts` asserts no `fetch` happens while a sensitive field is processed, and that the Layer-2 payload shape never carries a selected value, for any field that *is* sent.

# Jobsmith

Jobsmith is a Chrome extension (Manifest V3) that fills job applications from a CV kept in the browser and helps draft long-text answers. There is no account and no Jobsmith server — each person uses their own browser, their own data, and their own OpenAI API key.

## Setup

```sh
npm install
npm test
npm run dev
```

In Chrome, open `chrome://extensions`, turn on Developer mode, and load the unpacked extension from `.output/chrome-mv3-dev` (dev) or `.output/chrome-mv3` (production build, see below). Open the extension's options page to upload a CV, review your profile, and set preferences. The toolbar icon opens the side panel on the job page you're applying from.

`npm run build` writes a production build to `.output/chrome-mv3`. `npm run zip` packs it.

## What this version does

- **Onboarding.** Upload a CV (PDF or DOCX), extracts the text locally, sends only that text to OpenAI to parse into a structured profile, then a review screen and a short preferences wizard (sponsorship, notice period, salary, start date, relocation).
- **Autofill.** On an enabled site, "Detect fields" reads the form (labels, `aria-*`, name/autocomplete, nearby text) and "Fill" writes your profile and preferences into empty fields only, never overwriting something you already typed. Matching runs in three layers: synonym/heuristic matching first, a saved-answer-bank lookup for long-text questions, then an LLM fallback for whatever's still unmatched (background sends the model only each field's id/label/kind/option labels — never a value — and only applies a mapping it marked confident). Dropdown and radio values always go through the same confidence-scored matcher (exact → known alias → no guess on low confidence), on every layer. "Undo" reverts the fields the last fill touched. The stored CV is attached to empty file-upload inputs automatically.
- **Adapters.** Greenhouse and Lever have dedicated adapters and were tested against representative fixture pages (see Known limitations — these are hand-built fixtures, not captured live pages). Ashby, SmartRecruiters, and Workday use the same general-purpose detection without site-specific quirk handling yet.
- **Learning.** When you type an answer into a long-text field and move on, a small on-page prompt offers to save it to the answer bank. Future questions that are a close match (judged locally, no network call) reuse a saved answer instead of asking the model again.
- **AI answers.** The side panel can draft 2–3 answer variants (different angles: motivation, skills fit, company mission) for a pasted or on-page question, using the job description (read from the page's structured data or a visible block, or pasted by you) and a company brief (cached, then fetched, then asked for). A separate pass flags any claim in the draft that isn't backed by your CV or notes. Nothing is invented; if the model can't find a job description or company brief, it says so instead of guessing.
- **Sensitive fields.** Gender, ethnicity, disability, veteran status, sexual orientation, religion, and date-of-birth/age fields are detected by their label and never sent to the model, matched by heuristics, or filled from a generic value map. Each category has its own default in Options → Sensitive: ask every time (leave blank for you to handle), always select "prefer not to say" when the field offers it, or fill from a value you saved once. Saved values are plain text by default; ticking "Protect saved values with a passphrase" in that same section encrypts them (PBKDF2-SHA256 + AES-GCM, native Web Crypto, no extra dependency) and caches the passphrase only in `chrome.storage.session` for that browser session — never written to disk, never synced, forgotten when the browser closes. Filling a form with an encrypted value needs that passphrase to be unlocked for the session; if it isn't, that category falls back to "ask every time" rather than guessing or failing partway through a fill.
- **Site access.** Nothing is granted at install. Options → Sites lists one-click toggles for Greenhouse, Lever, Ashby, SmartRecruiters, and Workday, each requesting only that host pattern. "Enable Jobsmith on this site" requests the current tab's origin for any other company career page. LinkedIn and `lnkd.in` are refused even if a permission exists.
- **Data.** Export/import a JSON file (API key optional on export). "Delete all data" clears everything in this browser.

Default models, both editable in Settings → AI:

- `gpt-6-luna` for parsing, field mapping, and answers
- `gpt-6.1-sol` when "Better quality" is on

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Profile, preferences, sensitive-field defaults, and settings in this browser. |
| `scripting` | Injects the content script that detects and fills fields, only on a site you've allowed. |
| `sidePanel` | The panel that shows detected fields, fill/undo controls, and answer drafts. |
| `activeTab` | Reads the tab you're using when you click "Enable Jobsmith on this site". |
| `https://api.openai.com/*` | Your key calls OpenAI directly, from the background service worker. This host is not a browsing site. |

Site access is **not** granted at install. `optional_host_permissions` includes `<all_urls>` because Chrome only allows a runtime prompt for origins covered by that list; Jobsmith never requests `<all_urls>` itself. Each site switch requests one host pattern, such as `https://*.greenhouse.io/*`, and "Enable Jobsmith on this site" requests only that page's origin.

Not requested: `tabs`, `webRequest`, or a blanket host grant. LinkedIn (`linkedin.com`, `lnkd.in`) is blocked in code as well, independent of any permission that's been granted.

## What never happens

- Jobsmith never clicks Submit, Next, or any other form-progression control. You review and submit everything yourself.
- Jobsmith never interacts with a CAPTCHA.
- Jobsmith does not run on LinkedIn Easy Apply or `lnkd.in`, regardless of permissions.
- Gender, ethnicity, disability, veteran status, sexual orientation, religion, and date-of-birth/age values and labels are never included in a request to OpenAI.
- AI-drafted answers only draw on your CV and the notes you typed; a verification pass flags anything in a draft that isn't backed by either.
- No CV text, answer text, or saved answer is written to the console in a production build.

## Known limitations and deviations from the original plan

- **Test fixtures are hand-authored, not captured from live pages.** The plan was to save real public Greenhouse/Lever postings as HTML fixtures. What's in `tests/fixtures/html/` is representative markup I wrote by hand to match each platform's typical field structure, not a page capture. Treat the ≥90% fill-rate result from these fixtures as a check against the written detection logic, not a guarantee against live Greenhouse/Lever markup, which can differ or change.
- **Playwright was not set up.** Form-filling tests run with Vitest + jsdom against the same fixture files instead, using the ambient jsdom document so `instanceof` checks match the real DOM classes. This covers the same fill-rate and non-overwrite assertions but doesn't exercise a real Chromium renderer or the built extension end to end.
- **Ashby and SmartRecruiters use generic detection only** (no site-specific quirk handling yet). **Workday additionally gets a best-effort pass for its custom widgets**: ARIA combobox buttons (`role="combobox"`/`aria-haspopup="listbox"`) and three-input Month/Day/Year date groups. This has not been checked against a live Workday posting — see `ARCHITECTURE.md` §11 — and is conservative on purpose: a combobox or date group is only filled on a confident label-and-option match, a date group is only filled when its label maps to "earliest start date" specifically, and anything that reads as a sensitive category (by label) is skipped before it's ever opened or inspected, the same as every other sensitive field. There's no undo for these two widget types yet, unlike native fields.
- **"Better quality" toggle** changes which model answer drafting and parsing use, but there's no cost estimate shown yet.
- Workday boards on hosts like `company.wd1.myworkdayjobs.com` are more than one subdomain deep; the toggle covers the common pattern, but use "Enable Jobsmith on this site" if a particular Workday tenant's host doesn't match.

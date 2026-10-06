# Jobsmith

Jobsmith is a Chrome extension (Manifest V3) that will fill job applications from a CV kept in the browser. This version is the foundation: profile and settings storage, an options page, and export/import. CV parsing, form filling, and answer drafts are later phases.

There is no account and no Jobsmith server. Each person uses their own browser, their own data, and their own OpenAI API key.

## Setup

```sh
npm install
npm test
npm run dev
```

In Chrome, open `chrome://extensions`, turn on Developer mode, and load the unpacked extension from `.output/chrome-mv3`. Open the extension’s options page for settings. The toolbar icon opens the side panel.

`npm run build` writes a production build to the same output folder. `npm run zip` packs it.

## What this version does

- Stores a profile, preferences, sensitive-field defaults, and AI settings in `chrome.storage.local`.
- Stores documents, the answer bank, company briefs, and an application log in IndexedDB (Dexie). Those collections are empty until later phases write them.
- Lets you edit the profile and preferences, choose sensitive-field defaults, and save an API key plus model names.
- Tests the API key from the extension background with `GET https://api.openai.com/v1/models/{model}`.
- Exports and imports a JSON file. The API key is left out unless you tick “Include the API key”.
- Deletes all Jobsmith data in this browser.
- Can ask Chrome for permission to read a job site. LinkedIn is refused even if a permission exists.

Default models, both editable in settings:

- `gpt-6-luna` for parsing, field mapping, and answers
- `gpt-6.1-sol` when “Better quality” is on

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Profile, preferences, sensitive-field defaults, and settings in this browser. |
| `scripting` | Later phases inject the fill button only after you allow a site. |
| `sidePanel` | The panel that will show detected fields and answer drafts. |
| `activeTab` | Read the tab you are using when you click “Use the open tab”. |
| `https://api.openai.com/*` | Your key calls OpenAI directly. This host is not a browsing site. |

Site access is **not** granted at install. `optional_host_permissions` includes `<all_urls>` because Chrome only allows a runtime prompt for origins covered by that list. Jobsmith never requests `<all_urls>` itself. Each site switch requests one host pattern, such as `https://*.greenhouse.io/*`, and “Enable Jobsmith on this site” requests only that page’s origin.

Not requested: `tabs`, `webRequest`, or a blanket host grant. LinkedIn (`linkedin.com`, `lnkd.in`) is blocked in code as well.

## Known limitations

- Uploading a CV, reading a PDF or DOCX, and parsing it with the model are not built yet.
- Forms are not detected or filled. Greenhouse, Lever, and the other adapters are not built yet.
- The answer bank does not learn from typed answers yet. You can delete entries that were imported.
- Saved sensitive answers are stored unencrypted. Passphrase encryption (PBKDF2-SHA256 and AES-GCM) is a later phase.
- “Better quality” is stored but does not change any model call yet, because answer drafts are not built yet.
- Workday boards on hosts like `company.wd1.myworkdayjobs.com` are more than one subdomain deep. Use “Enable Jobsmith on this site” for those until the Workday phase.
- The extension does not click Submit or Next, and it does not solve CAPTCHAs.

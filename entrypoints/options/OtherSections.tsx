import { useEffect, useState } from "react";
import type { ZodError } from "zod";
import { answerBankSchema, type AnswerBankEntry } from "../../src/schemas/answerBank";
import type { DocumentMeta } from "../../src/schemas/documents";
import {
  sensitiveCategoryIds,
  sensitiveCategoryLabels,
  type SensitiveCategoryId,
  type SensitiveDefaults,
} from "../../src/schemas/sensitiveDefaults";
import { settingsSchema, type Settings } from "../../src/schemas/settings";
import { KNOWN_ATS } from "../../src/sites/access";
import { db } from "../../src/storage/db";
import { decryptWithPassphrase, encryptWithPassphrase, type EncryptedValue } from "../../src/storage/crypto";
import { deleteAllData, dumpRaw, exportAll, importAll } from "../../src/storage/transfer";
import { activeArea } from "../../src/storage/localStore";
import { clearSessionPassphrase, getSessionPassphrase, setSessionPassphrase } from "../../src/storage/sessionPassphrase";
import { downloadJson } from "../../src/ui/download";
import { EnableSiteForm } from "../../src/ui/EnableSiteForm";
import { testConnectionRequestSchema, testConnectionResultSchema } from "../../src/messaging/types";
import { Button, Card, SaveRow, SelectField, TextField } from "./fields";

export function DocumentsSection() {
  const [rows, setRows] = useState<DocumentMeta[] | null>(null);

  useEffect(() => {
    void db.documents.toArray().then((documents) => {
      setRows(
        documents.map((document) => ({
          id: document.id,
          schemaVersion: document.schemaVersion,
          kind: document.kind,
          fileName: document.fileName,
          mimeType: document.mimeType,
          parsedText: document.parsedText,
          createdAt: document.createdAt,
        })),
      );
    });
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-serif text-3xl">Documents</h2>
        <p className="mt-1 text-sm text-muted">CV upload arrives in the next phase. Files already stored in this browser are listed here.</p>
      </header>
      {rows === null ? <p className="text-sm text-muted">Loading…</p> : null}
      {rows?.length === 0 ? <Card><p className="text-sm text-muted">No documents yet.</p></Card> : null}
      {rows?.map((row) => (
        <Card key={row.id}>
          <h3 className="font-serif text-xl">{row.fileName || "Untitled file"}</h3>
          <p className="text-sm text-muted">{row.kind === "cv" ? "CV" : "Cover letter"} · {row.mimeType}</p>
          {row.parsedText ? <p className="line-clamp-4 text-sm whitespace-pre-wrap">{row.parsedText}</p> : null}
        </Card>
      ))}
    </div>
  );
}

export function AnswerBankSection() {
  const [rows, setRows] = useState<AnswerBankEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const entries = await db.answerBank.orderBy("updatedAt").reverse().toArray();
    setRows(entries);
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-serif text-3xl">Answer bank</h2>
        <p className="mt-1 text-sm text-muted">
          Saving answers from forms arrives later. Entries already in this browser can be reviewed or deleted.
        </p>
      </header>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {rows?.length === 0 ? <Card><p className="text-sm text-muted">No saved answers yet.</p></Card> : null}
      {rows?.map((row) => {
        const parsed = answerBankSchema.safeParse(row);
        if (!parsed.success) {
          return (
            <Card key={row.id}>
              <p className="text-sm text-clay">This entry could not be read and was left in place.</p>
            </Card>
          );
        }
        return (
          <Card key={row.id}>
            <h3 className="font-serif text-xl">{parsed.data.originalQuestion || parsed.data.normalizedQuestion}</h3>
            <p className="text-sm whitespace-pre-wrap">{parsed.data.answer}</p>
            <p className="text-sm text-muted">
              {[parsed.data.company, parsed.data.role].filter(Boolean).join(" · ") || "No company recorded"}
            </p>
            <Button
              tone="quiet"
              onClick={() => {
                void db.answerBank.delete(row.id).then(reload).catch(() => setError("Could not delete that answer."));
              }}
            >
              Delete answer
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

type EditableValues = Record<SensitiveCategoryId, string>;

function plainValuesFrom(defaults: SensitiveDefaults): EditableValues {
  const values = {} as EditableValues;
  for (const id of sensitiveCategoryIds) {
    const choice = defaults.categories[id];
    values[id] = choice.encrypted ? "" : choice.savedValue;
  }
  return values;
}

export function SensitiveSection({
  defaults,
  onSave,
}: {
  defaults: SensitiveDefaults;
  onSave: (defaults: SensitiveDefaults) => Promise<void>;
}) {
  const [draft, setDraft] = useState(defaults);
  const [editableValues, setEditableValues] = useState<EditableValues>(() => plainValuesFrom(defaults));
  const [encryptionEnabled, setEncryptionEnabled] = useState(() => sensitiveCategoryIds.some((id) => defaults.categories[id].encrypted));
  const [vaultPassphrase, setVaultPassphrase] = useState<string | null>(null);
  const [locked, setLocked] = useState(() => sensitiveCategoryIds.some((id) => defaults.categories[id].encrypted));
  const [unlockInput, setUnlockInput] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaults);
    const hasEncrypted = sensitiveCategoryIds.some((id) => defaults.categories[id].encrypted);
    setEncryptionEnabled(hasEncrypted);
    if (!hasEncrypted) {
      setLocked(false);
      setEditableValues(plainValuesFrom(defaults));
      return;
    }
    setLocked(true);
    void getSessionPassphrase().then((cached) => {
      if (cached) void unlock(cached, defaults);
    });
    // Re-run only when a different stored record arrives from the parent, not on every local edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults]);

  async function unlock(passphrase: string, source: SensitiveDefaults): Promise<boolean> {
    const next = {} as EditableValues;
    try {
      for (const id of sensitiveCategoryIds) {
        const choice = source.categories[id];
        next[id] = choice.encrypted && choice.savedValue ? await decryptWithPassphrase(JSON.parse(choice.savedValue) as EncryptedValue, passphrase) : choice.savedValue;
      }
    } catch {
      setVaultError("That passphrase did not unlock the saved values.");
      return false;
    }
    setEditableValues(next);
    setVaultPassphrase(passphrase);
    setLocked(false);
    setVaultError(null);
    await setSessionPassphrase(passphrase);
    return true;
  }

  async function setUpPassphrase() {
    if (newPassphrase.length < 8) {
      setVaultError("Use a passphrase of at least 8 characters.");
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      setVaultError("The two passphrases don't match.");
      return;
    }
    setVaultPassphrase(newPassphrase);
    setEncryptionEnabled(true);
    setLocked(false);
    setVaultError(null);
    setNewPassphrase("");
    setConfirmPassphrase("");
    await setSessionPassphrase(newPassphrase);
  }

  async function turnOffEncryption() {
    setEncryptionEnabled(false);
    setVaultPassphrase(null);
    await clearSessionPassphrase();
  }

  async function handleSave() {
    setPending(true);
    setNotice(null);
    try {
      const categories = {} as SensitiveDefaults["categories"];
      for (const id of sensitiveCategoryIds) {
        const choice = draft.categories[id];
        const plainText = editableValues[id] ?? "";
        if (choice.mode !== "use_saved_answer" || !encryptionEnabled) {
          categories[id] = { mode: choice.mode, savedValue: choice.mode === "use_saved_answer" ? plainText : "", encrypted: false };
          continue;
        }
        if (!vaultPassphrase) {
          throw new Error("Set a passphrase above before saving a protected value.");
        }
        const encrypted = await encryptWithPassphrase(plainText, vaultPassphrase);
        categories[id] = { mode: "use_saved_answer", savedValue: JSON.stringify(encrypted), encrypted: true };
      }
      const next: SensitiveDefaults = { ...draft, categories };
      await onSave(next);
      setDraft(next);
      setNotice("Sensitive-field defaults saved in this browser.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-serif text-3xl">Sensitive fields</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Gender, ethnicity, disability, veteran status, sexual orientation, religion, and date of birth are never sent to the model.
          Saved values stay in this browser, optionally behind a passphrase of your own.
        </p>
      </header>

      <Card>
        <h3 className="font-serif text-xl">Passphrase protection</h3>
        {locked ? (
          <div className="space-y-3">
            <p className="text-sm text-clay">Saved values are protected. Enter your passphrase to view or change them.</p>
            <TextField label="Passphrase" type="password" value={unlockInput} onChange={setUnlockInput} />
            <Button
              onClick={() => {
                void unlock(unlockInput, draft).then((ok) => {
                  if (ok) setUnlockInput("");
                });
              }}
            >
              Unlock
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={encryptionEnabled}
                onChange={(event) => {
                  setVaultError(null);
                  if (event.target.checked) setEncryptionEnabled(true);
                  else void turnOffEncryption();
                }}
              />
              Protect saved values with a passphrase
            </label>
            {encryptionEnabled && !vaultPassphrase ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="New passphrase" type="password" value={newPassphrase} onChange={setNewPassphrase} />
                <TextField label="Confirm passphrase" type="password" value={confirmPassphrase} onChange={setConfirmPassphrase} />
                <Button onClick={() => void setUpPassphrase()}>Set passphrase</Button>
              </div>
            ) : null}
            {encryptionEnabled && vaultPassphrase ? (
              <p className="text-sm text-muted">
                Passphrase set for this browser session. It is never saved to disk and is forgotten when the browser closes.
              </p>
            ) : null}
            {!encryptionEnabled ? <p className="text-sm text-muted">Saved values below are stored as plain text in this browser.</p> : null}
          </div>
        )}
        {vaultError ? <p className="text-sm text-clay">{vaultError}</p> : null}
      </Card>

      <Card>
        {sensitiveCategoryIds.map((id) => {
          const choice = draft.categories[id];
          return (
            <div key={id} className="grid gap-4 border-b border-line pb-4 last:border-b-0 sm:grid-cols-2">
              <SelectField
                label={sensitiveCategoryLabels[id]}
                value={choice.mode}
                onChange={(mode) => {
                  setNotice(null);
                  setDraft({
                    ...draft,
                    categories: {
                      ...draft.categories,
                      [id]: { ...choice, mode: mode as SensitiveDefaults["categories"]["gender"]["mode"] },
                    },
                  });
                }}
                options={[
                  { value: "ask_every_time", label: "Ask every time" },
                  { value: "prefer_not_to_say", label: "Prefer not to say" },
                  { value: "use_saved_answer", label: "Use a saved answer" },
                ]}
              />
              {choice.mode === "use_saved_answer" ? (
                locked ? (
                  <p className="self-center text-sm text-clay">Unlock above to view or edit this value.</p>
                ) : (
                  <TextField
                    label="Saved answer"
                    value={editableValues[id] ?? ""}
                    onChange={(value) => {
                      setNotice(null);
                      setEditableValues({ ...editableValues, [id]: value });
                    }}
                  />
                )
              ) : null}
            </div>
          );
        })}
      </Card>
      <SaveRow pending={pending} notice={notice} onSave={() => void handleSave()} />
    </div>
  );
}

export function SitesSection() {
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  async function refresh() {
    if (typeof chrome === "undefined" || !chrome.permissions) return;
    const next: Record<string, boolean> = {};
    for (const site of KNOWN_ATS) {
      next[site.id] = await chrome.permissions.contains({ origins: site.origins });
    }
    setGranted(next);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-3xl">Sites</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Nothing is granted at install. Each switch asks Chrome for that job-site host only. Other company career pages can be enabled one at a time.
          Greenhouse and Lever have the most testing; Ashby, SmartRecruiters, and Workday use the same general field detection.
          Workday's custom dropdowns and date pickers are not fully handled yet.
        </p>
      </header>
      <Card>
        <ul className="space-y-4">
          {KNOWN_ATS.map((site) => (
            <li key={site.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{site.label}</p>
                <p className="text-sm text-muted">{site.detail}</p>
              </div>
              <button
                type="button"
                aria-pressed={Boolean(granted[site.id])}
                onClick={() => {
                  void (async () => {
                    if (typeof chrome === "undefined" || !chrome.permissions) return;
                    if (granted[site.id]) await chrome.permissions.remove({ origins: site.origins });
                    else await chrome.permissions.request({ origins: site.origins });
                    await refresh();
                  })();
                }}
                className={`rounded-full px-3 py-1 text-sm ${granted[site.id] ? "bg-moss text-white" : "border border-line bg-paper"}`}
              >
                {granted[site.id] ? "On" : "Off"}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-serif text-xl">Another career site</h3>
        <EnableSiteForm />
      </Card>
    </div>
  );
}

export function AiSection({ settings, onSave }: { settings: Settings; onSave: (settings: Settings) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function update(partial: Partial<Settings>) {
    setDraft((current) => ({ ...current, ...partial }));
    setNotice(null);
  }

  async function testConnection() {
    setTesting(true);
    setTestMessage(null);
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        setTestMessage("Open Jobsmith from the extension to test the key.");
        return;
      }
      const message = testConnectionRequestSchema.parse({
        type: "test-connection",
        requestId: crypto.randomUUID(),
        payload: { apiKey: draft.apiKey, model: draft.models.parse },
      });
      const response = await chrome.runtime.sendMessage(message);
      const parsed = testConnectionResultSchema.safeParse(response);
      if (!parsed.success) {
        setTestMessage("The extension returned an unexpected result.");
        return;
      }
      setTestMessage(parsed.data.ok ? `Connected. Model ${parsed.data.model} is available.` : parsed.data.error);
    } catch {
      setTestMessage("Could not reach the extension background.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-serif text-3xl">AI</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          The key stays in this browser and is sent only to OpenAI, from the extension background. Everyday parsing and answers use the first model. Better quality uses the second.
        </p>
      </header>
      <Card>
        <div className="grid gap-4">
          <TextField
            label="OpenAI API key"
            type={showKey ? "text" : "password"}
            value={draft.apiKey}
            onChange={(apiKey) => update({ apiKey })}
          />
          <button type="button" className="w-fit text-sm text-moss-dark" onClick={() => setShowKey((current) => !current)}>
            {showKey ? "Hide key" : "Show key"}
          </button>
          <TextField
            label="Model for parsing and field mapping"
            value={draft.models.parse}
            onChange={(parse) => update({ models: { ...draft.models, parse } })}
          />
          <TextField
            label="Model for answers"
            value={draft.models.answer}
            onChange={(answer) => update({ models: { ...draft.models, answer } })}
          />
          <TextField
            label="Model for better quality"
            value={draft.models.answerBetter}
            onChange={(answerBetter) => update({ models: { ...draft.models, answerBetter } })}
          />
          <TextField label="Answer language" value={draft.language} onChange={(language) => update({ language })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.betterQuality}
              onChange={(event) => update({ betterQuality: event.target.checked })}
            />
            Better quality
          </label>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <SaveRow
          pending={pending}
          notice={notice}
          onSave={() => {
            const parsed = settingsSchema.safeParse(draft);
            if (!parsed.success) {
              setNotice("Enter a model name and a language code before saving.");
              return;
            }
            setPending(true);
            void onSave(parsed.data)
              .then(() => setNotice("AI settings saved in this browser."))
              .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not save."))
              .finally(() => setPending(false));
          }}
        />
        <Button tone="quiet" disabled={testing} onClick={() => void testConnection()}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
      </div>
      {testMessage ? <p className="text-sm">{testMessage}</p> : null}
    </div>
  );
}

export function DataSection({ onChanged }: { onChanged: () => Promise<void> }) {
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [preview, setPreview] = useState<unknown>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-serif text-3xl">Data</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Export and import stay on this computer. A normal export leaves the API key out. Deleting removes the profile, files, answers, and key from this browser.
        </p>
      </header>
      <Card>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeApiKey} onChange={(event) => setIncludeApiKey(event.target.checked)} />
          Include the API key in the export
        </label>
        <Button
          onClick={() => {
            void exportAll(includeApiKey, activeArea())
              .then((file) => {
                const day = file.exportedAt.slice(0, 10);
                downloadJson(`jobsmith-${day}.json`, file);
                setNotice(includeApiKey ? "Exported, including the API key." : "Exported without the API key.");
              })
              .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not export."));
          }}
        >
          Export JSON
        </Button>
        <Button
          tone="quiet"
          onClick={() => {
            void dumpRaw(activeArea())
              .then((raw) => downloadJson("jobsmith-raw-backup.json", raw))
              .catch(() => setNotice("Could not build a raw backup."));
          }}
        >
          Download raw backup
        </Button>
      </Card>
      <Card>
        <h3 className="font-serif text-xl">Import</h3>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Import JSON file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(null);
            setPreviewError(null);
            if (!file) return;
            void file.text().then((text) => {
              try {
                setPreview(JSON.parse(text) as unknown);
              } catch {
                setPreviewError("That file is not JSON.");
              }
            });
          }}
        />
        {previewError ? <p className="text-sm text-clay">{previewError}</p> : null}
        {preview ? (
          <Button
            onClick={() => {
              void importAll(preview, activeArea())
                .then(async (file) => {
                  setNotice(
                    file.local.settings.apiKey
                      ? "Imported, including an API key from the file."
                      : "Imported. The file had no API key, so the saved key is now blank.",
                  );
                  setPreview(null);
                  await onChanged();
                })
                .catch((error: unknown) => {
                  const zodError = error as ZodError;
                  setPreviewError(zodError?.issues?.[0]?.message ?? (error instanceof Error ? error.message : "Could not import that file."));
                });
            }}
          >
            Replace data in this browser
          </Button>
        ) : null}
      </Card>
      <Card>
        <h3 className="font-serif text-xl">Delete everything</h3>
        {confirmDelete ? (
          <div className="flex flex-wrap gap-2">
            <Button
              tone="danger"
              onClick={() => {
                void deleteAllData(activeArea())
                  .then(async () => {
                    setConfirmDelete(false);
                    setNotice("All Jobsmith data in this browser was deleted.");
                    await onChanged();
                  })
                  .catch(() => setNotice("Could not delete stored data."));
              }}
            >
              Delete everything
            </Button>
            <Button tone="quiet" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button tone="quiet" onClick={() => setConfirmDelete(true)}>
            Delete all data
          </Button>
        )}
      </Card>
      {notice ? <p className="text-sm">{notice}</p> : null}
    </div>
  );
}

export function AboutSection() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-serif text-3xl">About</h2>
      </header>
      <Card>
        <p className="text-sm leading-6">
          Jobsmith fills job applications from a CV you keep in this browser. There is no account and no Jobsmith server.
          The OpenAI key you add is stored locally and used only when you ask for a parse, a field mapping, or an answer.
        </p>
        <p className="text-sm leading-6">
          The extension does not click Submit or Next, and it does not run on LinkedIn. This version stores your profile and settings.
          Uploading a CV, filling forms, and drafting answers come in later phases.
        </p>
      </Card>
    </div>
  );
}

export function InvalidRecord({ title, error }: { title: string; error: string }) {
  return (
    <Card>
      <h2 className="font-serif text-3xl">{title}</h2>
      <p className="text-sm leading-6 text-clay">
        Stored data could not be read ({error}). It was left in place. Download a raw backup from Data before replacing it.
      </p>
    </Card>
  );
}

import { useState } from "react";
import { extractText } from "../../src/documents/extractText";
import { parseProfileFromCv } from "../../src/llm/prompts/parseProfile";
import { createEmptyPreferences, type Preferences } from "../../src/schemas/preferences";
import { createEmptyProfile, type Profile } from "../../src/schemas/profile";
import type { Settings } from "../../src/schemas/settings";
import { db } from "../../src/storage/db";
import { Button, Card, SelectField, TextField } from "./fields";
import { ProfileSection } from "./ProfileSection";

type Step = "upload" | "review" | "wizard" | "done";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

function fileKind(name: string): string {
  if (name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (name.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "";
}

export function CvOnboarding({
  settings,
  onProfileSaved,
  onPreferencesSaved,
}: {
  settings: Settings;
  onProfileSaved: (profile: Profile) => Promise<void>;
  onPreferencesSaved: (preferences: Preferences) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile>(createEmptyProfile());
  const [preferencesDraft, setPreferencesDraft] = useState<Preferences>(createEmptyPreferences());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [fileMeta, setFileMeta] = useState<{ fileName: string; mimeType: string; blob: Blob } | null>(null);

  async function handleFile(file: File) {
    const mimeType = ACCEPTED_TYPES.includes(file.type) ? file.type : fileKind(file.name);
    if (!mimeType) {
      setError("Upload a PDF or a Word (.docx) file.");
      return;
    }
    setError(null);
    setBusy(true);
    const start = Date.now();
    setStartedAt(start);
    try {
      const text = await extractText(file, mimeType);
      if (!text.trim()) throw new Error("Could not find any text in that file. Try exporting the CV as a PDF with selectable text.");
      const parsed = await parseProfileFromCv({ apiKey: settings.apiKey, model: settings.models.parse, cvText: text });
      setDraft(parsed);
      setFileMeta({ fileName: file.name, mimeType, blob: file });
      setElapsedMs(Date.now() - start);
      setStep("review");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that CV.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfileAndContinue(profile: Profile) {
    await onProfileSaved(profile);
    if (fileMeta) {
      const text = await extractText(fileMeta.blob, fileMeta.mimeType).catch(() => "");
      await db.documents.put({
        id: "cv",
        schemaVersion: 1,
        kind: "cv",
        fileName: fileMeta.fileName,
        mimeType: fileMeta.mimeType,
        parsedText: text,
        createdAt: new Date().toISOString(),
        blob: fileMeta.blob,
      });
    }
    setStep("wizard");
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-3xl">Upload a CV</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a PDF or Word file. Text is read in this browser, then sent to the model you set in AI settings to build a
          profile you can correct.
        </p>
      </header>

      {step === "upload" ? (
        <Card>
          {!settings.apiKey ? (
            <p className="text-sm text-clay">Add an OpenAI API key in Settings → AI before uploading a CV.</p>
          ) : null}
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="Upload CV"
            disabled={busy || !settings.apiKey}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {busy ? <p className="text-sm text-muted">Reading and parsing your CV…</p> : null}
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </Card>
      ) : null}

      {step === "review" ? (
        <div className="space-y-4">
          {elapsedMs !== null ? (
            <p className="text-sm text-muted">
              Parsed in {(elapsedMs / 1000).toFixed(1)}s. Check every field below before saving — nothing is kept until you
              save.
            </p>
          ) : null}
          <ProfileSection
            profile={draft}
            onSave={async (profile) => {
              setDraft(profile);
              await saveProfileAndContinue(profile);
            }}
          />
        </div>
      ) : null}

      {step === "wizard" ? (
        <PreferencesWizard
          draft={preferencesDraft}
          onChange={setPreferencesDraft}
          onFinish={async () => {
            await onPreferencesSaved(preferencesDraft);
            setStep("done");
          }}
        />
      ) : null}

      {step === "done" ? (
        <Card>
          <p className="text-sm">
            {startedAt ? `Profile ready in ${((Date.now() - startedAt) / 1000).toFixed(0)}s total. ` : ""}
            Saved. Open the Profile and Preferences tabs any time to adjust it further.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function PreferencesWizard({
  draft,
  onChange,
  onFinish,
}: {
  draft: Preferences;
  onChange: (preferences: Preferences) => void;
  onFinish: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const sponsorship = draft.sponsorshipNeeded === null ? "" : draft.sponsorshipNeeded ? "yes" : "no";

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: "Right to work",
      body: (
        <SelectField
          label="Do you need visa sponsorship?"
          value={sponsorship}
          onChange={(value) => onChange({ ...draft, sponsorshipNeeded: value === "" ? null : value === "yes" })}
          options={[
            { value: "", label: "Not set" },
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      ),
    },
    {
      title: "Notice period",
      body: <TextField label="Notice period" value={draft.noticePeriod} onChange={(noticePeriod) => onChange({ ...draft, noticePeriod })} />,
    },
    {
      title: "Salary expectation",
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Amount"
            value={draft.salaryExpectation.amount}
            onChange={(amount) => onChange({ ...draft, salaryExpectation: { ...draft.salaryExpectation, amount } })}
          />
          <TextField
            label="Currency"
            value={draft.salaryExpectation.currency}
            onChange={(currency) => onChange({ ...draft, salaryExpectation: { ...draft.salaryExpectation, currency } })}
          />
        </div>
      ),
    },
    {
      title: "Start date",
      body: <TextField label="Earliest start date" value={draft.startDate} onChange={(startDate) => onChange({ ...draft, startDate })} />,
    },
    {
      title: "Relocation",
      body: (
        <SelectField
          label="Willing to relocate?"
          value={draft.relocation}
          onChange={(relocation) => onChange({ ...draft, relocation: relocation as Preferences["relocation"] })}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "discuss", label: "Discuss" },
          ]}
        />
      ),
    },
  ];

  const current = steps[index] ?? steps[0];
  const last = index === steps.length - 1;
  if (!current) return null;

  return (
    <Card>
      <p className="text-xs tracking-wide text-muted uppercase">
        Step {index + 1} of {steps.length}
      </p>
      <h3 className="font-serif text-xl">{current.title}</h3>
      {current.body}
      <div className="flex gap-2">
        {index > 0 ? (
          <Button tone="quiet" onClick={() => setIndex((value) => value - 1)}>
            Back
          </Button>
        ) : null}
        <Button
          onClick={() => {
            if (last) void onFinish();
            else setIndex((value) => value + 1);
          }}
        >
          {last ? "Finish" : "Next"}
        </Button>
      </div>
    </Card>
  );
}

import { useState } from "react";
import type { FillStatus } from "../../src/messaging/fillTypes";
import { useActiveTabMessage } from "../../src/ui/useActiveTabMessaging";
import { EnableSiteForm } from "../../src/ui/EnableSiteForm";
import { FieldList } from "./FieldList";
import { AnswerDraftPanel } from "./AnswerDraftPanel";
import { CoverLetterPanel } from "./CoverLetterPanel";
import { ThemeToggle } from "../../src/ui/ThemeToggle";

export default function App() {
  const sendToTab = useActiveTabMessage();
  const [status, setStatus] = useState<FillStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function detect() {
    setBusy(true);
    setError(null);
    const result = await sendToTab<FillStatus>({ type: "get-fill-status" });
    if (!result) setError("Open a job application page, then try again.");
    else setStatus(result);
    setBusy(false);
  }

  async function fill() {
    setBusy(true);
    setError(null);
    const result = await sendToTab<FillStatus>({ type: "run-fill" });
    if (!result) setError("Open a job application page, then try again.");
    else setStatus(result);
    setBusy(false);
  }

  async function undo() {
    await sendToTab({ type: "undo-fill" });
    await detect();
  }

  async function replace(fieldId: string) {
    const result = await sendToTab<{ ok: boolean; error?: string }>({ type: "replace-field-answer", payload: { fieldId } });
    if (!result?.ok) setError(result?.error ?? "Could not draft a different answer.");
  }

  async function setOverride(fieldId: string, profileKey: string) {
    const result = await sendToTab<{ ok: boolean; error?: string }>({ type: "set-field-override", payload: { fieldId, profileKey } });
    if (!result?.ok) {
      setError(result?.error ?? "Could not save that mapping.");
      return;
    }
    await detect();
  }

  const filledCount = status?.fields.filter((field) => field.status === "filled" || field.status === "filled_ai_draft").length ?? 0;

  return (
    <main className="space-y-6 p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Jobsmith</p>
          <h1 className="font-serif text-2xl">This page</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open settings"
            title="Settings"
            onClick={() => chrome.runtime.openOptionsPage()}
            className="rounded-md border border-line bg-card p-2 text-muted hover:text-ink"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {status?.blocked ? (
        <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-clay">{status.blockedReason}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void detect()} className="rounded-md border border-line bg-card px-3 py-2 text-sm disabled:opacity-50">
              Preview fill
            </button>
            <button type="button" disabled={busy} onClick={() => void fill()} className="rounded-md bg-moss px-3 py-2 text-sm text-white disabled:opacity-50">
              Fill
            </button>
            {status ? (
              <button type="button" onClick={() => void undo()} className="rounded-md border border-line bg-card px-3 py-2 text-sm">
                Undo last fill
              </button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
          {status ? (
            <>
              <p className="text-sm text-muted">
                {status.preview
                  ? `${filledCount} of ${status.totalFields} fields would be filled. Click a field below to see why, or the value it would get. Nothing on the page has changed yet.`
                  : `${filledCount} of ${status.totalFields} fields filled. Review everything before you submit — Jobsmith never clicks Submit or Next for you.`}
              </p>
              <FieldList fields={status.fields} onReplace={replace} onSetOverride={setOverride} />
            </>
          ) : null}
        </div>
      )}

      <AnswerDraftPanel />
      <CoverLetterPanel />

      <div className="border-t border-line pt-4">
        <h2 className="font-serif text-lg">Not on the list?</h2>
        <p className="mt-1 text-sm text-muted">LinkedIn stays off either way.</p>
        <div className="mt-3">
          <EnableSiteForm />
        </div>
      </div>
    </main>
  );
}

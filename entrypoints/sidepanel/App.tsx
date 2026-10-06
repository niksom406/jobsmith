import { useState } from "react";
import type { FillStatus } from "../../src/messaging/fillTypes";
import { useActiveTabMessage } from "../../src/ui/useActiveTabMessaging";
import { EnableSiteForm } from "../../src/ui/EnableSiteForm";
import { FieldList } from "./FieldList";
import { AnswerDraftPanel } from "./AnswerDraftPanel";

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

  const filledCount = status?.fields.filter((field) => field.status === "filled").length ?? 0;

  return (
    <main className="space-y-6 p-4">
      <header>
        <p className="text-xs tracking-wide text-muted uppercase">Jobsmith</p>
        <h1 className="font-serif text-2xl">This page</h1>
      </header>

      {status?.blocked ? (
        <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-clay">{status.blockedReason}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void detect()} className="rounded-md border border-line bg-card px-3 py-2 text-sm disabled:opacity-50">
              Detect fields
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
                {filledCount} of {status.totalFields} fields filled. Review everything before you submit — Jobsmith never
                clicks Submit or Next for you.
              </p>
              <FieldList fields={status.fields} />
            </>
          ) : null}
        </div>
      )}

      <AnswerDraftPanel />

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

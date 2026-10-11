import { useState } from "react";
import type { FillStatus } from "../../src/messaging/fillTypes";
import { useActiveTabMessage } from "../../src/ui/useActiveTabMessaging";
import { EnableSiteForm } from "../../src/ui/EnableSiteForm";
import { FieldList } from "./FieldList";
import { AnswerDraftPanel } from "./AnswerDraftPanel";
import { CoverLetterPanel } from "./CoverLetterPanel";
import { ThemeToggle } from "../../src/ui/ThemeToggle";

function JobsmithLogo() {
  return (
    <img src={chrome.runtime.getURL("/icon/128.png")} alt="Jobsmith Logo" width="28" height="28" style={{ borderRadius: "5px" }} />
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3L2 9.2h7.6z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l9.5-9.5c.8-.8 2-.8 2.8 0l5.7 5.7c.8.8.8 2 0 2.8L14 20" />
      <path d="M6.6 15.4 14 8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

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
    setStatus(null);
  }

  async function clearAll() {
    await sendToTab({ type: "undo-fill" });
    setStatus(null);
  }

  async function replace(fieldId: string): Promise<{ ok: boolean; canRevert?: boolean; error?: string }> {
    const result = await sendToTab<{ ok: boolean; canRevert?: boolean; error?: string }>({
      type: "replace-field-answer",
      payload: { fieldId },
    });
    return result ?? { ok: false, error: "Could not reach the extension content script." };
  }

  async function revert(fieldId: string): Promise<{ ok: boolean; canRevert?: boolean; error?: string }> {
    const result = await sendToTab<{ ok: boolean; canRevert?: boolean; error?: string }>({
      type: "revert-field-answer",
      payload: { fieldId },
    });
    return result ?? { ok: false, error: "Could not reach the extension content script." };
  }

  async function setOverride(fieldId: string, profileKey: string) {
    const result = await sendToTab<{ ok: boolean; error?: string }>({ type: "set-field-override", payload: { fieldId, profileKey } });
    if (!result?.ok) {
      setError(result?.error ?? "Could not save that mapping.");
      return;
    }
    await detect();
  }

  const filledCount = status?.fields.filter((f) => f.status === "filled" || f.status === "filled_ai_draft").length ?? 0;
  const hasFilled = filledCount > 0;

  return (
    <main
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        minHeight: "100vh",
        background: "var(--color-paper)",
        color: "var(--color-ink)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--color-line)",
          background: "var(--color-card)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <JobsmithLogo />
            <div>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  letterSpacing: "-0.3px",
                  lineHeight: 1.1,
                  color: "var(--color-ink)",
                }}
              >
                Jobsmith
              </p>
              <p style={{ fontSize: "10px", color: "var(--color-muted)", marginTop: "1px" }}>
                AI Job Autofill
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Open settings"
              title="Settings"
              onClick={() => chrome.runtime.openOptionsPage()}
              style={{
                padding: "6px",
                borderRadius: "8px",
                border: "1px solid var(--color-line)",
                background: "transparent",
                color: "var(--color-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px" }} className="space-y-4">
        {status?.blocked ? (
          <div
            style={{
              borderRadius: "10px",
              border: "1px solid rgba(248,113,113,0.3)",
              background: "rgba(248,113,113,0.08)",
              padding: "12px",
              fontSize: "13px",
              color: "#f87171",
            }}
          >
            {status.blockedReason}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void detect()}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 14px",
                  borderRadius: "9px",
                  border: "1px solid var(--color-line)",
                  background: "var(--color-card)",
                  color: "var(--color-ink)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.5 : 1,
                  transition: "all 0.15s",
                }}
              >
                <SearchIcon /> Preview
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void fill()}
                style={{
                  flex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "9px 14px",
                  borderRadius: "9px",
                  border: "none",
                  background: "linear-gradient(135deg, #C9A84C 0%, #e8c96a 100%)",
                  color: "#1a1500",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                  boxShadow: "0 2px 8px rgba(201,168,76,0.35)",
                  transition: "all 0.15s",
                }}
              >
                <SparkleIcon />
                {busy ? "Filling…" : "Fill form"}
              </button>
            </div>

            {/* Undo + Clear buttons — only show after a fill */}
            {status && !status.preview && hasFilled && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void undo()}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-line)",
                    background: "var(--color-card)",
                    color: "var(--color-muted)",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <UndoIcon /> Undo last fill
                </button>
                <button
                  type="button"
                  onClick={() => void clearAll()}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(248,113,113,0.3)",
                    background: "rgba(248,113,113,0.07)",
                    color: "#f87171",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <EraserIcon /> Clear all
                </button>
              </div>
            )}

            {error && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#f87171",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(248,113,113,0.2)",
                  background: "rgba(248,113,113,0.07)",
                }}
              >
                {error}
              </p>
            )}

            {status && (
              <div className="space-y-3">
                <p style={{ fontSize: "12px", color: "var(--color-muted)", lineHeight: 1.5 }}>
                  {status.preview
                    ? `${filledCount} of ${status.totalFields} fields would be filled. Nothing changed yet.`
                    : `${filledCount} of ${status.totalFields} fields filled. Review before submitting.`}
                </p>
                <FieldList
                  fields={status.fields}
                  onReplace={replace}
                  onRevert={revert}
                  onSetOverride={setOverride}
                />
              </div>
            )}
          </div>
        )}

        <AnswerDraftPanel />
        <CoverLetterPanel />

        <div
          style={{
            borderTop: "1px solid var(--color-line)",
            paddingTop: "16px",
          }}
        >
          <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Not on the list?</p>
          <p style={{ fontSize: "12px", color: "var(--color-muted)", marginBottom: "12px" }}>
            LinkedIn stays off either way.
          </p>
          <EnableSiteForm />
        </div>
      </div>
    </main>
  );
}

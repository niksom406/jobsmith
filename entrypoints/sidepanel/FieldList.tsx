import { useState } from "react";
import type { FieldSummary } from "../../src/messaging/fillTypes";
import { PROFILE_KEY_LABELS } from "../../src/autofill/profileValues";

const STATUS_LABEL: Record<FieldSummary["status"], string> = {
  filled: "Filled",
  filled_ai_draft: "Drafted by AI",
  skipped_not_empty: "Already had a value",
  skipped_no_value: "No value in your profile",
  skipped_low_confidence: "Not confident, left blank",
  skipped_sensitive: "Sensitive, left for you",
  unmatched: "Not recognised",
};

// Green for anything Jobsmith successfully filled; red for anything that needs your attention
// (couldn't recognise it, or deliberately left it for you); grey for everything else (already had
// a value, no data to use, etc. -- not a problem, just nothing to report).
const STATUS_TONE: Record<FieldSummary["status"], string> = {
  filled: "text-moss-dark",
  filled_ai_draft: "text-moss-dark",
  skipped_not_empty: "text-muted",
  skipped_no_value: "text-muted",
  skipped_low_confidence: "text-clay",
  skipped_sensitive: "text-clay",
  unmatched: "text-clay",
};

const FILLED_STATUSES = new Set<FieldSummary["status"]>(["filled", "filled_ai_draft"]);

function ArrowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Counterclockwise-arrows ("🔄") icon -- regenerates the drafted answer in a different tone. */
function RegenerateIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "inline-block animate-spin" : "inline-block"}
    >
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
      <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" />
    </svg>
  );
}

/** Undo-style curved arrow -- steps this one field back to the version it held before the last regenerate. */
function RevertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

const OVERRIDE_ELIGIBLE = new Set<FieldSummary["status"]>(["unmatched", "skipped_no_value", "skipped_low_confidence"]);

export function FieldList({
  fields,
  onReplace,
  onRevert,
  onSetOverride,
}: {
  fields: FieldSummary[];
  onReplace?: (fieldId: string) => Promise<{ ok: boolean; canRevert?: boolean; error?: string }>;
  onRevert?: (fieldId: string) => Promise<{ ok: boolean; canRevert?: boolean; error?: string }>;
  onSetOverride?: (fieldId: string, profileKey: string) => Promise<void>;
}) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingOverrideId, setSavingOverrideId] = useState<string | null>(null);
  // Whether each AI-drafted field has an earlier version to step back to -- starts false (the first
  // draft has nothing before it) and flips to true after the first "Regenerate" click on that field.
  const [canRevertByField, setCanRevertByField] = useState<Record<string, boolean>>({});
  const [fieldError, setFieldError] = useState<{ fieldId: string; message: string } | null>(null);

  if (fields.length === 0) return <p className="text-sm text-muted">No fields detected on this page yet.</p>;

  async function handleReplace(fieldId: string) {
    if (!onReplace) return;
    setReplacingId(fieldId);
    setFieldError(null);
    try {
      const result = await onReplace(fieldId);
      if (result.ok) setCanRevertByField((current) => ({ ...current, [fieldId]: result.canRevert ?? true }));
      else setFieldError({ fieldId, message: result.error ?? "Could not draft a different answer." });
    } finally {
      setReplacingId(null);
    }
  }

  async function handleRevert(fieldId: string) {
    if (!onRevert) return;
    setRevertingId(fieldId);
    setFieldError(null);
    try {
      const result = await onRevert(fieldId);
      if (result.ok) setCanRevertByField((current) => ({ ...current, [fieldId]: result.canRevert ?? false }));
      else setFieldError({ fieldId, message: result.error ?? "Could not go back to the previous version." });
    } finally {
      setRevertingId(null);
    }
  }

  function toggleExpanded(fieldId: string) {
    setExpandedId((current) => (current === fieldId ? null : fieldId));
  }

  async function handleSetOverride(fieldId: string, profileKey: string) {
    if (!onSetOverride) return;
    setSavingOverrideId(fieldId);
    try {
      await onSetOverride(fieldId, profileKey);
    } finally {
      setSavingOverrideId(null);
    }
  }

  return (
    <ul className="space-y-2">
      {fields.map((field) => (
        <li key={field.id} className="rounded-md border border-line bg-card px-3 py-2 text-sm">
          <button
            type="button"
            onClick={() => toggleExpanded(field.id)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={expandedId === field.id}
          >
            <span>{field.label || `(${field.kind} field)`}</span>
            <span className="flex items-center gap-2">
              <span className={`flex items-center gap-1 ${STATUS_TONE[field.status]}`}>
                {FILLED_STATUSES.has(field.status) ? <ArrowIcon /> : null}
                {STATUS_LABEL[field.status]}
              </span>
            </span>
          </button>
          {expandedId === field.id ? (
            <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
              {field.previewValue ? (
                <p>
                  <span className="font-medium text-ink">Value:</span> {field.previewValue}
                </p>
              ) : null}
              {field.detail ? <p>{field.detail}</p> : null}
              {OVERRIDE_ELIGIBLE.has(field.status) && onSetOverride ? (
                <div className="flex items-center gap-2 pt-1">
                  <label htmlFor={`override-${field.id}`} className="text-ink">
                    Map this field to:
                  </label>
                  <select
                    id={`override-${field.id}`}
                    disabled={savingOverrideId === field.id}
                    defaultValue=""
                    onChange={(event) => void handleSetOverride(field.id, event.target.value)}
                    className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink"
                  >
                    <option value="" disabled>
                      Choose a profile field…
                    </option>
                    {Object.entries(PROFILE_KEY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted">Remembered for this site.</span>
                </div>
              ) : null}
              {field.status === "filled_ai_draft" && (onReplace || onRevert) ? (
                <div className="flex items-center gap-2 pt-1">
                  {onReplace ? (
                    <button
                      type="button"
                      title="Regenerate in a different tone"
                      aria-label="Regenerate in a different tone"
                      disabled={replacingId === field.id}
                      onClick={() => void handleReplace(field.id)}
                      className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                    >
                      <RegenerateIcon spinning={replacingId === field.id} />
                      Regenerate
                    </button>
                  ) : null}
                  {onRevert ? (
                    <button
                      type="button"
                      title="Go back to the previous version"
                      aria-label="Go back to the previous version"
                      disabled={revertingId === field.id || !canRevertByField[field.id]}
                      onClick={() => void handleRevert(field.id)}
                      className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                    >
                      <RevertIcon />
                      {revertingId === field.id ? "…" : "Previous version"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {fieldError?.fieldId === field.id ? <p className="text-clay">{fieldError.message}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

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

const OVERRIDE_ELIGIBLE = new Set<FieldSummary["status"]>(["unmatched", "skipped_no_value", "skipped_low_confidence"]);

export function FieldList({
  fields,
  onReplace,
  onSetOverride,
}: {
  fields: FieldSummary[];
  onReplace?: (fieldId: string) => Promise<void>;
  onSetOverride?: (fieldId: string, profileKey: string) => Promise<void>;
}) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingOverrideId, setSavingOverrideId] = useState<string | null>(null);

  if (fields.length === 0) return <p className="text-sm text-muted">No fields detected on this page yet.</p>;

  async function handleReplace(fieldId: string) {
    if (!onReplace) return;
    setReplacingId(fieldId);
    try {
      await onReplace(fieldId);
    } finally {
      setReplacingId(null);
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
              {field.status === "filled_ai_draft" && onReplace ? (
                <button
                  type="button"
                  disabled={replacingId === field.id}
                  onClick={() => void handleReplace(field.id)}
                  className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                >
                  {replacingId === field.id ? "…" : "Replace"}
                </button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

import { useState } from "react";
import type { FieldSummary } from "../../src/messaging/fillTypes";

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

export function FieldList({
  fields,
  onReplace,
}: {
  fields: FieldSummary[];
  onReplace?: (fieldId: string) => Promise<void>;
}) {
  const [replacingId, setReplacingId] = useState<string | null>(null);

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

  return (
    <ul className="space-y-2">
      {fields.map((field) => (
        <li key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2 text-sm">
          <span>{field.label || `(${field.kind} field)`}</span>
          <span className="flex items-center gap-2">
            <span className={`flex items-center gap-1 ${STATUS_TONE[field.status]}`}>
              {FILLED_STATUSES.has(field.status) ? <ArrowIcon /> : null}
              {STATUS_LABEL[field.status]}
            </span>
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
          </span>
        </li>
      ))}
    </ul>
  );
}

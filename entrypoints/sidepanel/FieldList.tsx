import type { FieldSummary } from "../../src/messaging/fillTypes";

const STATUS_LABEL: Record<FieldSummary["status"], string> = {
  filled: "Filled",
  skipped_not_empty: "Already had a value",
  skipped_no_value: "No value in your profile",
  skipped_low_confidence: "Not confident, left blank",
  skipped_sensitive: "Sensitive, left for you",
  unmatched: "Not recognised",
};

const STATUS_TONE: Record<FieldSummary["status"], string> = {
  filled: "text-moss-dark",
  skipped_not_empty: "text-muted",
  skipped_no_value: "text-muted",
  skipped_low_confidence: "text-clay",
  skipped_sensitive: "text-clay",
  unmatched: "text-muted",
};

export function FieldList({ fields }: { fields: FieldSummary[] }) {
  if (fields.length === 0) return <p className="text-sm text-muted">No fields detected on this page yet.</p>;
  return (
    <ul className="space-y-2">
      {fields.map((field) => (
        <li key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2 text-sm">
          <span>{field.label || `(${field.kind} field)`}</span>
          <span className={STATUS_TONE[field.status]}>{STATUS_LABEL[field.status]}</span>
        </li>
      ))}
    </ul>
  );
}

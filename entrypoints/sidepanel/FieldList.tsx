import { useState } from "react";
import type { FieldSummary } from "../../src/messaging/fillTypes";
import { PROFILE_KEY_LABELS } from "../../src/autofill/profileValues";
import { literalOverrideValue } from "../../src/autofill/fieldOverrides";

const STATUS_LABEL: Record<FieldSummary["status"], string> = {
  filled: "Filled",
  filled_ai_draft: "AI drafted",
  skipped_not_empty: "Already filled",
  skipped_no_value: "No profile data",
  skipped_low_confidence: "Left for you",
  skipped_sensitive: "Sensitive",
  unmatched: "Not recognised",
};

const STATUS_TONE: Record<FieldSummary["status"], string> = {
  filled: "text-emerald-400",
  filled_ai_draft: "text-emerald-400",
  skipped_not_empty: "text-zinc-500",
  skipped_no_value: "text-zinc-500",
  skipped_low_confidence: "text-amber-400",
  skipped_sensitive: "text-amber-400",
  unmatched: "text-rose-400",
};

const FILLED_STATUSES = new Set<FieldSummary["status"]>(["filled", "filled_ai_draft"]);
const PROBLEM_STATUSES = new Set<FieldSummary["status"]>(["unmatched", "skipped_low_confidence", "skipped_sensitive"]);
const OVERRIDE_ELIGIBLE = new Set<FieldSummary["status"]>(["unmatched", "skipped_no_value", "skipped_low_confidence"]);

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block flex-shrink-0">
      <polyline points="4 10 8 14 16 6" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block flex-shrink-0">
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline-block flex-shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}>
      <polyline points="4 7 10 13 16 7" />
    </svg>
  );
}

function RegenerateIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={spinning ? "inline-block animate-spin" : "inline-block"}>
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
      <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" />
    </svg>
  );
}

function RevertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

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
  const [literalInputByField, setLiteralInputByField] = useState<Record<string, string>>({});
  const [canRevertByField, setCanRevertByField] = useState<Record<string, boolean>>({});
  const [fieldError, setFieldError] = useState<{ fieldId: string; message: string } | null>(null);

  if (fields.length === 0) return (
    <p className="py-4 text-center text-sm" style={{ color: "var(--color-muted)" }}>
      No fields detected on this page yet.
    </p>
  );

  const filledCount = fields.filter((f) => FILLED_STATUSES.has(f.status)).length;
  const problemCount = fields.filter((f) => PROBLEM_STATUSES.has(f.status)).length;

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
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(0,0,0,0.15)" }}>
        <span className="flex items-center gap-1" style={{ color: "#34d399" }}>
          <CheckIcon /> <strong>{filledCount}</strong> filled
        </span>
        {problemCount > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#f87171" }}>
            <CrossIcon /> <strong>{problemCount}</strong> need attention
          </span>
        )}
        <span style={{ color: "var(--color-muted)" }}>of {fields.length} total</span>
      </div>

      <ul className="space-y-1.5">
        {fields.map((field) => {
          const isFilled = FILLED_STATUSES.has(field.status);
          const isProblem = PROBLEM_STATUSES.has(field.status);
          const isExpanded = expandedId === field.id;

          return (
            <li
              key={field.id}
              className="rounded-lg border text-sm overflow-hidden transition-all duration-150"
              style={{
                borderColor: isFilled
                  ? "rgba(52,211,153,0.25)"
                  : isProblem
                  ? "rgba(248,113,113,0.25)"
                  : "var(--color-line)",
                background: isFilled
                  ? "rgba(52,211,153,0.05)"
                  : isProblem
                  ? "rgba(248,113,113,0.04)"
                  : "var(--color-card)",
              }}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(field.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                aria-expanded={isExpanded}
              >
                {/* Left: status icon + label */}
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex-shrink-0 ${STATUS_TONE[field.status]}`}
                  >
                    {isFilled ? <CheckIcon /> : isProblem ? <CrossIcon /> : null}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      fontWeight: isFilled ? 600 : 400,
                      color: isFilled
                        ? "var(--color-ink)"
                        : isProblem
                        ? "var(--color-ink)"
                        : "var(--color-muted)",
                    }}
                  >
                    {field.label || `(${field.kind} field)`}
                  </span>
                </span>

                {/* Right: status pill + chevron */}
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_TONE[field.status]}`}
                    style={{
                      background: isFilled
                        ? "rgba(52,211,153,0.12)"
                        : isProblem
                        ? "rgba(248,113,113,0.12)"
                        : "rgba(255,255,255,0.06)",
                    }}
                  >
                    {STATUS_LABEL[field.status]}
                  </span>
                  <span style={{ color: "var(--color-muted)" }}>
                    <ChevronIcon expanded={isExpanded} />
                  </span>
                </span>
              </button>

              {isExpanded && (
                <div
                  className="px-3 pb-3 space-y-2 text-xs border-t"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
                >
                  {field.previewValue && (
                    <p className="pt-2">
                      <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Value: </span>
                      {field.previewValue}
                    </p>
                  )}
                  {field.detail && <p className="pt-1">{field.detail}</p>}

                  {OVERRIDE_ELIGIBLE.has(field.status) && onSetOverride && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label htmlFor={`override-${field.id}`} style={{ color: "var(--color-ink)" }}>
                          Map to profile field:
                        </label>
                        <select
                          id={`override-${field.id}`}
                          disabled={savingOverrideId === field.id}
                          defaultValue=""
                          onChange={(event) => void handleSetOverride(field.id, event.target.value)}
                          className="rounded-md px-2 py-1 text-xs"
                          style={{
                            border: "1px solid var(--color-line)",
                            background: "var(--color-card)",
                            color: "var(--color-ink)",
                          }}
                        >
                          <option value="" disabled>Choose a profile field…</option>
                          {Object.entries(PROFILE_KEY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`override-literal-${field.id}`} style={{ color: "var(--color-ink)" }}>
                          Or type the answer:
                        </label>
                        <input
                          id={`override-literal-${field.id}`}
                          type="text"
                          disabled={savingOverrideId === field.id}
                          value={literalInputByField[field.id] ?? ""}
                          onChange={(event) =>
                            setLiteralInputByField((current) => ({ ...current, [field.id]: event.target.value }))
                          }
                          placeholder="e.g. Yes"
                          className="w-28 rounded-md px-2 py-1 text-xs"
                          style={{
                            border: "1px solid var(--color-line)",
                            background: "var(--color-card)",
                            color: "var(--color-ink)",
                          }}
                        />
                        <button
                          type="button"
                          disabled={
                            savingOverrideId === field.id ||
                            !(literalInputByField[field.id] ?? "").trim()
                          }
                          onClick={() =>
                            void handleSetOverride(
                              field.id,
                              literalOverrideValue((literalInputByField[field.id] ?? "").trim()),
                            )
                          }
                          className="rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
                          style={{
                            border: "1px solid var(--color-line)",
                            background: "var(--color-card)",
                            color: "var(--color-muted)",
                          }}
                        >
                          Save
                        </button>
                      </div>
                      <span style={{ color: "var(--color-muted)" }}>
                        Remembered for this site — auto-fills next time.
                      </span>
                    </div>
                  )}

                  {field.status === "filled_ai_draft" && (onReplace || onRevert) && (
                    <div className="flex items-center gap-2 pt-1">
                      {onReplace && (
                        <button
                          type="button"
                          title="Regenerate in a different tone"
                          disabled={replacingId === field.id}
                          onClick={() => void handleReplace(field.id)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
                          style={{
                            border: "1px solid var(--color-line)",
                            background: "var(--color-card)",
                            color: "var(--color-muted)",
                          }}
                        >
                          <RegenerateIcon spinning={replacingId === field.id} />
                          Regenerate
                        </button>
                      )}
                      {onRevert && (
                        <button
                          type="button"
                          title="Go back to the previous version"
                          disabled={revertingId === field.id || !canRevertByField[field.id]}
                          onClick={() => void handleRevert(field.id)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
                          style={{
                            border: "1px solid var(--color-line)",
                            background: "var(--color-card)",
                            color: "var(--color-muted)",
                          }}
                        >
                          <RevertIcon />
                          {revertingId === field.id ? "…" : "Previous"}
                        </button>
                      )}
                    </div>
                  )}

                  {fieldError?.fieldId === field.id && (
                    <p style={{ color: "#f87171" }}>{fieldError.message}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

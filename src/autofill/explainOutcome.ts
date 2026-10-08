import { PROFILE_KEY_LABELS } from "./profileValues";
import type { FieldSummary } from "../messaging/fillTypes";

/**
 * A short, specific reason for a field's status, shown when you click it in the side panel. Every
 * one of these corresponds to an actual decision Jobsmith made (never a guess at why) -- the
 * `profileKey`, when present, is the exact profile field Jobsmith tried to use.
 */
export function explainOutcome(status: FieldSummary["status"], profileKey?: string): string {
  const keyLabel = profileKey ? (PROFILE_KEY_LABELS[profileKey] ?? profileKey) : null;

  switch (status) {
    case "filled":
      return keyLabel ? `Filled from your saved "${keyLabel}".` : "Filled from your profile.";
    case "filled_ai_draft":
      return "Drafted by AI from the job description on this page, since no profile field matched.";
    case "skipped_not_empty":
      return "Already had a value, so Jobsmith left it alone.";
    case "skipped_no_value":
      return keyLabel
        ? `Jobsmith matched this to "${keyLabel}", but you don't have a value saved for it yet.`
        : "No saved value applies to this question.";
    case "skipped_low_confidence":
      return keyLabel
        ? `Matched this to "${keyLabel}", but none of the field's options were a confident match for your saved value -- Jobsmith doesn't guess.`
        : "Found a possible match, but it wasn't confident enough to fill without guessing.";
    case "skipped_sensitive":
      return 'This looks like a sensitive question (e.g. gender, ethnicity, disability, veteran status, sexual orientation, religion, or date of birth). Set a default in Options → Sensitive fields, or answer it yourself.';
    case "unmatched":
      return "Jobsmith couldn't match this to anything in your profile or preferences.";
    default:
      return "";
  }
}

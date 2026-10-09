import type { Preferences } from "../schemas/preferences";

const RELOCATION_LABEL: Record<Preferences["relocation"], string> = {
  yes: "Yes",
  no: "No",
  discuss: "Open to discussing it",
};

const REMOTE_LABEL: Record<Preferences["remotePreference"], string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Flexible / no strong preference",
};

const TRAVEL_LABEL: Record<Preferences["willingnessToTravel"], string> = {
  none: "Not willing to travel for work",
  occasional: "Willing to travel occasionally",
  frequent: "Willing to travel frequently",
};

/**
 * A plain-text block of the logistics facts already saved in Preferences -- notice period, start
 * date, salary expectation, sponsorship, relocation, remote preference, and right-to-work status --
 * so a drafted essay answer can use a real saved fact (e.g. "my notice period is one month") instead
 * of saying it has no information, when the question actually asks about one of these. Only
 * non-empty/non-default fields are included; this is handed to the model the same way the user's own
 * notes are, so the "use only the facts you were given" rule in the system prompt still applies --
 * nothing here is invented, it's exactly what's saved in Options -> Preferences.
 */
export function buildKnownFactsNote(preferences: Preferences): string {
  const lines: string[] = [];
  if (preferences.noticePeriod.trim()) lines.push(`Notice period: ${preferences.noticePeriod.trim()}`);
  if (preferences.startDate.trim()) lines.push(`Available start date: ${preferences.startDate.trim()}`);
  if (preferences.salaryExpectation.amount.trim()) {
    lines.push(
      `Salary expectation: ${preferences.salaryExpectation.amount.trim()} ${preferences.salaryExpectation.currency} per ${preferences.salaryExpectation.period}`,
    );
  }
  if (preferences.sponsorshipNeeded !== null) {
    lines.push(`Needs visa sponsorship: ${preferences.sponsorshipNeeded ? "Yes" : "No"}`);
  }
  lines.push(`Willing to relocate: ${RELOCATION_LABEL[preferences.relocation]}`);
  lines.push(`Work location preference: ${REMOTE_LABEL[preferences.remotePreference]}`);
  lines.push(`Travel for work: ${TRAVEL_LABEL[preferences.willingnessToTravel]}`);
  if (preferences.rightToWork.length > 0) {
    lines.push(`Right to work: ${preferences.rightToWork.map((entry) => `${entry.country} (${entry.status})`).join(", ")}`);
  }
  if (lines.length === 0) return "";
  return `Saved logistics facts (use only if the question actually asks about one of these; ignore the rest):\n${lines.join("\n")}`;
}

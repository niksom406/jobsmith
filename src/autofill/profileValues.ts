import type { Preferences } from "../schemas/preferences";
import type { Profile } from "../schemas/profile";
import type { ProfileValueMap } from "./types";

/** Flattens a profile and preferences into simple string values keyed by a stable profile key. */
export function flattenProfileValues(profile: Profile, preferences: Preferences): ProfileValueMap {
  const first = profile.name.split(" ")[0] ?? "";
  const last = profile.name.split(" ").slice(1).join(" ");
  const latestRole = profile.workHistory[0];
  const latestEducation = profile.education[0];

  const values: ProfileValueMap = {
    "name.full": profile.name,
    "name.first": first,
    "name.last": last,
    email: profile.email,
    phone: profile.phone,
    "address.line1": profile.address.line1,
    "address.line2": profile.address.line2,
    "address.city": profile.address.city,
    "address.region": profile.address.region,
    "address.postalCode": profile.address.postalCode,
    "address.country": profile.address.country,
    "links.linkedin": profile.links.linkedin,
    "links.github": profile.links.github,
    "links.portfolio": profile.links.portfolio,
    summary: profile.summary,
    skills: profile.skills.join(", "),
    "work.title": latestRole?.title ?? "",
    "work.company": latestRole?.company ?? "",
    "education.school": latestEducation?.school ?? "",
    "education.degree": latestEducation?.degree ?? "",
    "preferences.noticePeriod": preferences.noticePeriod,
    "preferences.startDate": preferences.startDate,
    "preferences.salaryAmount": preferences.salaryExpectation.amount,
    "preferences.salaryCurrency": preferences.salaryExpectation.currency,
    "preferences.relocation": preferences.relocation,
    "preferences.remotePreference": preferences.remotePreference,
    "preferences.sponsorshipNeeded":
      preferences.sponsorshipNeeded === null ? "" : preferences.sponsorshipNeeded ? "Yes" : "No",
  };

  for (const key of Object.keys(values)) {
    if (values[key] == null) values[key] = "";
  }
  return values;
}

export const PROFILE_KEY_LABELS: Record<string, string> = {
  "name.full": "Full name",
  "name.first": "First name",
  "name.last": "Last name",
  email: "Email",
  phone: "Phone",
  "address.line1": "Address line 1",
  "address.line2": "Address line 2",
  "address.city": "City",
  "address.region": "State / county / region",
  "address.postalCode": "Postal code",
  "address.country": "Country",
  "links.linkedin": "LinkedIn",
  "links.github": "GitHub",
  "links.portfolio": "Portfolio",
  summary: "Summary",
  skills: "Skills",
  "work.title": "Current job title",
  "work.company": "Current employer",
  "education.school": "School / university",
  "education.degree": "Degree",
  "preferences.noticePeriod": "Notice period",
  "preferences.startDate": "Start date",
  "preferences.salaryAmount": "Salary expectation",
  "preferences.salaryCurrency": "Salary currency",
  "preferences.relocation": "Willing to relocate",
  "preferences.remotePreference": "Remote work preference",
  "preferences.sponsorshipNeeded": "Sponsorship needed",
};

import type { DetectedField, FieldMatch } from "./types";

/** Synonym lists per profile key. Matched against autocomplete, name/id, and label text. */
const SYNONYMS: Record<string, string[]> = {
  "name.full": ["full name", "fullname", "name", "applicant name", "your name"],
  "name.first": ["first name", "firstname", "given name", "fname"],
  "name.last": ["last name", "lastname", "surname", "family name", "lname"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "cell"],
  "address.line1": ["address", "street address", "address line 1", "address1"],
  "address.line2": ["address line 2", "address2", "apartment", "suite"],
  "address.city": ["city", "town"],
  "address.region": ["state", "region", "province", "county"],
  "address.postalCode": ["postal code", "zip", "zip code", "postcode"],
  "address.country": ["country", "nationality"],
  "links.linkedin": ["linkedin", "linkedin url", "linkedin profile"],
  "links.github": ["github", "github url"],
  "links.portfolio": ["portfolio", "website", "personal website", "portfolio url"],
  summary: ["summary", "about you", "professional summary"],
  skills: ["skills", "key skills"],
  "work.title": ["current title", "job title", "current position"],
  "work.company": ["current company", "current employer", "employer"],
  "education.school": ["school", "university", "college"],
  "education.degree": ["degree", "qualification"],
  "preferences.noticePeriod": ["notice period"],
  "preferences.startDate": ["start date", "available from", "earliest start date"],
  "preferences.salaryAmount": ["salary expectation", "desired salary", "expected salary", "compensation expectation"],
  "preferences.relocation": ["relocation", "willing to relocate"],
  "preferences.remotePreference": ["remote preference", "work location preference"],
  "preferences.sponsorshipNeeded": ["sponsorship", "visa sponsorship", "require sponsorship", "need sponsorship"],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Label-only version of the synonym match, for widgets that aren't a native input/select/textarea (for
 * example an ARIA combobox button) and so never go through `detectFields`. Same exact-then-alias rule,
 * same no-guess-on-weak-match behaviour as `matchFieldHeuristically`.
 */
export function matchLabelToProfileKey(label: string): string | null {
  const haystack = normalize(label);
  if (!haystack) return null;

  for (const [profileKey, synonyms] of Object.entries(SYNONYMS)) {
    if (synonyms.some((synonym) => normalize(synonym) === haystack)) return profileKey;
  }
  for (const [profileKey, synonyms] of Object.entries(SYNONYMS)) {
    if (synonyms.some((synonym) => haystack.includes(normalize(synonym)))) return profileKey;
  }
  return null;
}

const AUTOCOMPLETE_MAP: Record<string, string> = {
  name: "name.full",
  "given-name": "name.first",
  "family-name": "name.last",
  email: "email",
  tel: "phone",
  "address-line1": "address.line1",
  "address-line2": "address.line2",
  "address-level2": "address.city",
  "address-level1": "address.region",
  "postal-code": "address.postalCode",
  country: "address.country",
  "country-name": "address.country",
  url: "links.portfolio",
};

/** Layer 1: match a field to a profile key using autocomplete, then name/id, then label text. */
export function matchFieldHeuristically(field: DetectedField): FieldMatch | null {
  const autocomplete = field.autocomplete.toLowerCase().replace(/^section-\w+\s*/, "");
  const autocompleteKey = AUTOCOMPLETE_MAP[autocomplete];
  if (autocompleteKey) return { fieldId: field.id, profileKey: autocompleteKey, confidence: "exact" };

  const haystacks = [normalize(field.name), normalize(field.label)].filter(Boolean);
  if (haystacks.length === 0) return null;

  for (const [profileKey, synonyms] of Object.entries(SYNONYMS)) {
    for (const synonym of synonyms) {
      const normalizedSynonym = normalize(synonym);
      if (haystacks.some((haystack) => haystack === normalizedSynonym)) {
        return { fieldId: field.id, profileKey, confidence: "exact" };
      }
    }
  }
  for (const [profileKey, synonyms] of Object.entries(SYNONYMS)) {
    for (const synonym of synonyms) {
      const normalizedSynonym = normalize(synonym);
      if (haystacks.some((haystack) => haystack.includes(normalizedSynonym))) {
        return { fieldId: field.id, profileKey, confidence: "alias" };
      }
    }
  }
  return null;
}

export function matchFieldsHeuristically(fields: DetectedField[]): { matches: FieldMatch[]; unmatched: DetectedField[] } {
  const matches: FieldMatch[] = [];
  const unmatched: DetectedField[] = [];
  for (const field of fields) {
    const match = matchFieldHeuristically(field);
    if (match) matches.push(match);
    else unmatched.push(field);
  }
  return { matches, unmatched };
}

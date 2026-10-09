import { expect, test } from "vitest";
import { createEmptyPreferences } from "../schemas/preferences";
import { buildKnownFactsNote } from "./knownFacts";

test("includes a saved notice period so an availability question can use the real value", () => {
  const preferences = { ...createEmptyPreferences(), noticePeriod: "1 month" };
  const note = buildKnownFactsNote(preferences);
  expect(note).toContain("Notice period: 1 month");
});

test("includes salary expectation, sponsorship, and right-to-work facts when saved", () => {
  const preferences = {
    ...createEmptyPreferences(),
    salaryExpectation: { amount: "55000", currency: "GBP", period: "year" as const },
    sponsorshipNeeded: false,
    rightToWork: [{ country: "United Kingdom", status: "citizen" as const }],
  };
  const note = buildKnownFactsNote(preferences);
  expect(note).toContain("55000 GBP per year");
  expect(note).toContain("Needs visa sponsorship: No");
  expect(note).toContain("United Kingdom (citizen)");
});

test("does not fabricate a notice period or start date when none is saved", () => {
  const note = buildKnownFactsNote(createEmptyPreferences());
  expect(note).not.toContain("Notice period:");
  expect(note).not.toContain("Available start date:");
});

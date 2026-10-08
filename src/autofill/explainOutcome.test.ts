import { expect, test } from "vitest";
import { explainOutcome } from "./explainOutcome";

test("names the actual profile field for skipped_no_value", () => {
  expect(explainOutcome("skipped_no_value", "preferences.noticePeriod")).toContain("Notice period");
});

test("names the actual profile field for a filled field", () => {
  expect(explainOutcome("filled", "email")).toContain("Email");
});

test("gives a generic reason when there's no profile key to name", () => {
  expect(explainOutcome("unmatched")).toContain("couldn't match");
});

test("explains a sensitive skip without needing a profile key", () => {
  expect(explainOutcome("skipped_sensitive")).toContain("Sensitive fields");
});

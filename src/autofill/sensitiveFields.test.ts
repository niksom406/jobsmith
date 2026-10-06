// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectSensitiveCategory, findPreferNotToSayOption } from "./sensitiveFields";
import type { DetectedField } from "./types";

function field(partial: Partial<DetectedField>): DetectedField {
  return {
    id: "f1",
    kind: "select",
    label: "",
    name: "",
    autocomplete: "",
    required: false,
    options: [],
    element: document.createElement("select"),
    ...partial,
  };
}

test("detects gender, religion, and date of birth from the label", () => {
  expect(detectSensitiveCategory(field({ label: "Gender" }))).toBe("gender");
  expect(detectSensitiveCategory(field({ label: "What is your religion?" }))).toBe("religion");
  expect(detectSensitiveCategory(field({ label: "Date of birth" }))).toBe("dateOfBirth");
});

test("does not flag an ordinary field", () => {
  expect(detectSensitiveCategory(field({ label: "Notice period" }))).toBeNull();
});

test("finds a prefer-not-to-say option when present", () => {
  const options = [{ value: "m", label: "Male" }, { value: "f", label: "Female" }, { value: "x", label: "Prefer not to say" }];
  expect(findPreferNotToSayOption(field({ options }))).toBe("x");
});

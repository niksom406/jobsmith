// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectFields } from "./detect";
import { fieldSignature, matchesFromOverrides, overrideKey } from "./fieldOverrides";

function setUpField() {
  document.body.innerHTML = `<label for="ctc">Current CTC</label><input id="ctc">`;
  return detectFields(document)[0]!;
}

test("the same field on the same site always produces the same signature", () => {
  const field = setUpField();
  expect(fieldSignature(field)).toBe(fieldSignature(field));
  expect(overrideKey("acme.com", field)).toBe(`acme.com::${fieldSignature(field)}`);
});

test("an override turns an unmatched field into an exact-confidence match", () => {
  const field = setUpField();
  const key = overrideKey("acme.com", field);
  const { matches, excludedFieldIds } = matchesFromOverrides([field], { [key]: "preferences.salaryAmount" }, "acme.com");
  expect(matches).toEqual([{ fieldId: field.id, profileKey: "preferences.salaryAmount", confidence: "exact" }]);
  expect(excludedFieldIds.has(field.id)).toBe(true);
});

test("an override saved for one hostname doesn't apply on another", () => {
  const field = setUpField();
  const key = overrideKey("acme.com", field);
  const { matches } = matchesFromOverrides([field], { [key]: "preferences.salaryAmount" }, "other.com");
  expect(matches).toEqual([]);
});

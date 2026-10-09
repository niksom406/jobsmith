// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectFields } from "./detect";
import { fieldSignature, literalOverrideValue, matchesFromOverrides, overrideKey } from "./fieldOverrides";

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

test("a literal override (no corresponding profile field, e.g. 'Do you have Fintech experience?') is remembered as a plain answer, not a profile-key mapping", () => {
  document.body.innerHTML = `
    <fieldset><legend>Do you have Fintech experience?</legend>
      <label><input type="radio" name="fintech" value="yes">Yes</label>
      <label><input type="radio" name="fintech" value="no">No</label>
    </fieldset>
  `;
  const field = detectFields(document)[0]!;
  const key = overrideKey("acme.com", field);
  const { matches, excludedFieldIds, literalValues } = matchesFromOverrides([field], { [key]: literalOverrideValue("Yes") }, "acme.com");
  expect(matches).toHaveLength(1);
  expect(excludedFieldIds.has(field.id)).toBe(true);
  const [match] = matches;
  expect(literalValues[match!.profileKey]).toBe("Yes");
});

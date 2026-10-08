// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectFields } from "./detect";
import { applyRightToWork, matchRightToWorkAnswer } from "./rightToWork";

test("answers 'Yes' when the named country is in the saved right-to-work list", () => {
  const result = matchRightToWorkAnswer("Do you have the right to work in the UK?", [{ country: "United Kingdom", status: "citizen" }]);
  expect(result).toBe("Yes");
});

test("answers 'No' for a specific named country the saved list doesn't include", () => {
  const result = matchRightToWorkAnswer("Do you have the right to work in the UK?", [{ country: "Ireland", status: "citizen" }]);
  expect(result).toBe("No");
});

test("never guesses when the saved right-to-work list is empty", () => {
  expect(matchRightToWorkAnswer("Do you have the right to work in the UK?", [])).toBeNull();
});

test("never guesses when the question doesn't name a country Jobsmith recognises", () => {
  const result = matchRightToWorkAnswer("Do you have the right to work in this country?", [{ country: "United Kingdom", status: "citizen" }]);
  expect(result).toBeNull();
});

test("fills a right-to-work radio question end-to-end from the saved country list", () => {
  document.body.innerHTML = `
    <fieldset>
      <legend>Do you have the right to work in the UK?</legend>
      <label><input type="radio" name="rtw" value="yes"> Yes</label>
      <label><input type="radio" name="rtw" value="no"> No</label>
    </fieldset>
  `;
  const fields = detectFields(document);
  const result = applyRightToWork(fields, [{ country: "United Kingdom", status: "citizen" }]);
  expect(result.outcomes[0]?.status).toBe("filled");
  const yesRadio = document.querySelector('input[name="rtw"][value="yes"]') as HTMLInputElement;
  expect(yesRadio.checked).toBe(true);
});

test("leaves a right-to-work question unfilled (not a guessed 'No') when nothing is saved yet", () => {
  document.body.innerHTML = `
    <fieldset>
      <legend>Do you have the right to work in the UK?</legend>
      <label><input type="radio" name="rtw" value="yes"> Yes</label>
      <label><input type="radio" name="rtw" value="no"> No</label>
    </fieldset>
  `;
  const fields = detectFields(document);
  const result = applyRightToWork(fields, []);
  expect(result.outcomes[0]?.status).toBe("skipped_no_value");
  expect(document.querySelector('input[name="rtw"]:checked')).toBeNull();
});

// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectFields } from "./detect";
import { fillFields } from "./fill";
import { matchFieldsHeuristically } from "./heuristics";

test("fills a bucketed salary-expectation select from a plain saved number", () => {
  document.body.innerHTML = `
    <label for="salary">Salary expectation</label>
    <select id="salary">
      <option value="">Please select</option>
      <option value="a">£40,000 - £50,000</option>
      <option value="b">£50,000 - £60,000</option>
    </select>
  `;
  const fields = detectFields(document);
  const { matches } = matchFieldsHeuristically(fields);
  const { outcomes } = fillFields(fields, matches, { "preferences.salaryAmount": "45000" });
  expect(outcomes[0]?.status).toBe("filled");
  expect((document.getElementById("salary") as HTMLSelectElement).value).toBe("a");
});

test("does not guess a salary bucket when the number falls outside every range", () => {
  document.body.innerHTML = `
    <label for="salary">Salary expectation</label>
    <select id="salary">
      <option value="">Please select</option>
      <option value="a">£40,000 - £50,000</option>
    </select>
  `;
  const fields = detectFields(document);
  const { matches } = matchFieldsHeuristically(fields);
  const { outcomes } = fillFields(fields, matches, { "preferences.salaryAmount": "90000" });
  expect(outcomes[0]?.status).toBe("skipped_low_confidence");
  expect((document.getElementById("salary") as HTMLSelectElement).value).toBe("");
});

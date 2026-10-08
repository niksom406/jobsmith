// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectFields } from "./detect";
import { matchFieldHeuristically, matchFieldsHeuristically } from "./heuristics";

test("Address Line 2 resolves to address.line2, not address.line1", () => {
  document.body.innerHTML = `
    <label for="addr1">Address</label><input id="addr1" name="address1">
    <label for="addr2">Address Line 2</label><input id="addr2" name="address2">
  `;
  const fields = detectFields(document);
  const { matches } = matchFieldsHeuristically(fields);
  const byFieldId = new Map(matches.map((match) => [match.fieldId, match.profileKey]));

  const line1Field = fields.find((field) => field.name === "address1");
  const line2Field = fields.find((field) => field.name === "address2");
  expect(byFieldId.get(line1Field?.id ?? "")).toBe("address.line1");
  expect(byFieldId.get(line2Field?.id ?? "")).toBe("address.line2");
});

test("a bare 'Address' label still resolves to address.line1", () => {
  document.body.innerHTML = `<label for="addr">Address</label><input id="addr" name="address">`;
  const fields = detectFields(document);
  const match = matchFieldHeuristically(fields[0]!);
  expect(match?.profileKey).toBe("address.line1");
});

test("an essay question is not hijacked by a one-word alias substring match, in a textarea...", () => {
  document.body.innerHTML = `
    <label for="essay">What relevant experience/skills will you be bringing to the team if you were to join us in this role?</label>
    <textarea id="essay"></textarea>
  `;
  const fields = detectFields(document);
  const match = matchFieldHeuristically(fields[0]!);
  expect(match).toBeNull();
});

test("...or in a long-maxlength text input, but a short field just named 'Skills' still matches", () => {
  document.body.innerHTML = `
    <label for="essay">Tell us about your experience with our tech stack and why you want this role</label>
    <input id="essay" type="text">
    <label for="skills">Skills</label>
    <input id="skills" type="text">
  `;
  (document.getElementById("essay") as HTMLInputElement).maxLength = 500;
  const fields = detectFields(document);
  const essayField = fields.find((field) => field.id.includes("essay")) ?? fields[0]!;
  const skillsField = fields.find((field) => field.label === "Skills")!;
  expect(matchFieldHeuristically(essayField)).toBeNull();
  expect(matchFieldHeuristically(skillsField)?.profileKey).toBe("skills");
});

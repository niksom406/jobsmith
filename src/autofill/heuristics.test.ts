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

// @vitest-environment jsdom
import { expect, test } from "vitest";
import { createEmptySensitiveDefaults } from "../schemas/sensitiveDefaults";
import { detectFields } from "./detect";
import { applySensitiveDefaults } from "./applySensitiveDefaults";

function setUpGenderSelect() {
  document.body.innerHTML = `
    <select id="gender" name="gender">
      <option value="">Select</option>
      <option value="m">Male</option>
      <option value="f">Female</option>
      <option value="x">Prefer not to say</option>
    </select>
  `;
}

test("ask_every_time leaves the field untouched and marked for the user", () => {
  setUpGenderSelect();
  const fields = detectFields(document);
  const defaults = createEmptySensitiveDefaults();
  const result = applySensitiveDefaults(fields, defaults);
  expect(result.excludedFieldIds.size).toBe(1);
  expect(result.outcomes[0]?.status).toBe("skipped_sensitive");
  expect((document.getElementById("gender") as HTMLSelectElement).value).toBe("");
});

test("prefer_not_to_say selects that option automatically", () => {
  setUpGenderSelect();
  const fields = detectFields(document);
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.gender = { mode: "prefer_not_to_say", savedValue: "", encrypted: false };
  const result = applySensitiveDefaults(fields, defaults);
  expect(result.outcomes[0]?.status).toBe("filled");
  expect((document.getElementById("gender") as HTMLSelectElement).value).toBe("x");
});

test("use_saved_answer fills the saved value and never leaves it for the LLM layer", () => {
  setUpGenderSelect();
  const fields = detectFields(document);
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.gender = { mode: "use_saved_answer", savedValue: "Female", encrypted: false };
  const result = applySensitiveDefaults(fields, defaults);
  expect((document.getElementById("gender") as HTMLSelectElement).value).toBe("f");
  expect(result.excludedFieldIds.has(fields[0]?.id ?? "")).toBe(true);
});

test("use_saved_answer fills a native date-of-birth input from a free-typed, non-ISO saved value", () => {
  document.body.innerHTML = `<label for="dob">Date of birth</label><input id="dob" type="date">`;
  const fields = detectFields(document);
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.dateOfBirth = { mode: "use_saved_answer", savedValue: "15/03/1990", encrypted: false };
  const result = applySensitiveDefaults(fields, defaults);
  expect(result.outcomes[0]?.status).toBe("filled");
  expect((document.getElementById("dob") as HTMLInputElement).value).toBe("1990-03-15");
});

test("a saved date the browser can't parse is reported as skipped, not a misleading 'filled'", () => {
  document.body.innerHTML = `<label for="dob">Date of birth</label><input id="dob" type="date">`;
  const fields = detectFields(document);
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.dateOfBirth = { mode: "use_saved_answer", savedValue: "whenever I was born", encrypted: false };
  const result = applySensitiveDefaults(fields, defaults);
  expect(result.outcomes[0]?.status).toBe("skipped_low_confidence");
  expect((document.getElementById("dob") as HTMLInputElement).value).toBe("");
});

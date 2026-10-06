// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { createEmptySensitiveDefaults } from "../schemas/sensitiveDefaults";
import { applySensitiveDefaults } from "./applySensitiveDefaults";
import { detectFields } from "./detect";
import { fieldsForMapping } from "../llm/prompts/mapFields";

test("filling a sensitive field makes no network request at all", () => {
  document.body.innerHTML = `
    <select id="gender" name="gender">
      <option value="">Select</option>
      <option value="f">Female</option>
      <option value="x">Prefer not to say</option>
    </select>
  `;
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const fields = detectFields(document);
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.gender = { mode: "use_saved_answer", savedValue: "Female", encrypted: false };
  applySensitiveDefaults(fields, defaults);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("the Layer 2 LLM payload only ever carries id, label, kind, and option labels — never a selected value", () => {
  document.body.innerHTML = `
    <select id="gender" name="gender">
      <option value="">Select</option>
      <option value="f">Female</option>
    </select>
  `;
  (document.getElementById("gender") as HTMLSelectElement).value = "f";
  const fields = detectFields(document);
  const payload = fieldsForMapping(fields);
  const first = payload[0];
  expect(first).toBeDefined();
  expect(Object.keys(first ?? {}).sort()).toEqual(["id", "kind", "label", "options"]);
});

// @vitest-environment jsdom
import { expect, test } from "vitest";
import { detectFields } from "../../autofill/detect";
import { fieldsForMapping, mapUnmatchedFields } from "./mapFields";

test("fieldsForMapping never includes a selected or typed value", () => {
  document.body.innerHTML = `
    <input id="referral" name="referral" value="Jane Doe referred me" />
    <select id="country"><option value="uk" selected>United Kingdom</option></select>
  `;
  const fields = detectFields(document);
  const payload = fieldsForMapping(fields);
  for (const field of payload) {
    expect(Object.keys(field).sort()).toEqual(["id", "kind", "label", "options"]);
  }
  expect(JSON.stringify(payload)).not.toContain("Jane Doe referred me");
});

test("mapUnmatchedFields sends only id/label/kind/options, never asks about a specific value", async () => {
  let sentBody = "";
  const fetchImpl: typeof fetch = async (_url, init) => {
    sentBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({ output_text: JSON.stringify({ mappings: [{ fieldId: "field-1", profileKey: "email", confident: true }] }) }),
      { status: 200 },
    );
  };

  const mappings = await mapUnmatchedFields({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    fields: [{ id: "field-1", label: "Email address", kind: "text", options: [] }],
    profileKeys: ["email", "phone"],
    fetchImpl,
  });

  expect(mappings).toEqual([{ fieldId: "field-1", profileKey: "email", confident: true }]);
  expect(sentBody).not.toMatch(/@|\d{3}-\d{3}/); // no email or phone-shaped value was ever sent
});

test("returns no mappings for an empty field list without calling the model", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("should not be called");
  };
  const mappings = await mapUnmatchedFields({ apiKey: "sk-test", model: "gpt-6-luna", fields: [], profileKeys: [], fetchImpl });
  expect(mappings).toEqual([]);
});

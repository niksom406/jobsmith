// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { createEmptyPreferences } from "../schemas/preferences";
import { createEmptyProfile } from "../schemas/profile";
import { detectFields } from "./detect";
import { fillFields } from "./fill";
import { matchFieldsHeuristically } from "./heuristics";
import { flattenProfileValues } from "./profileValues";

/**
 * Loads a fixture into the current jsdom environment's document (not a separate JSDOM
 * instance), so `instanceof HTMLInputElement` checks in detect.ts see the same realm.
 */
function loadFixture(path: string): Document {
  const html = readFileSync(path, "utf-8");
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  document.body.innerHTML = bodyMatch?.[1] ?? html;
  return document;
}

function sampleProfile() {
  return {
    ...createEmptyProfile(),
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+44 20 7946 0958",
    address: { ...createEmptyProfile().address, line1: "12 Example St", city: "London", postalCode: "EC1A 1AA", country: "United Kingdom" },
    links: { linkedin: "linkedin.com/in/ada", github: "github.com/ada", portfolio: "ada.dev" },
  };
}

function samplePreferences() {
  return {
    ...createEmptyPreferences(),
    noticePeriod: "1 month",
    sponsorshipNeeded: false,
    relocation: "yes" as const,
  };
}

test("fills at least 90% of standard fields on the Greenhouse fixture", () => {
  const document = loadFixture(resolve(process.cwd(), "tests/fixtures/html/greenhouse/sample.html"));
  const fields = detectFields(document);
  const { matches } = matchFieldsHeuristically(fields);
  const values = flattenProfileValues(sampleProfile(), samplePreferences());
  const { outcomes } = fillFields(fields, matches, values);

  // Resume (file) and the open-ended cover letter are out of scope for the heuristic layer by design.
  const standardFields = fields.filter((field) => field.kind !== "file" && field.kind !== "textarea");
  const filledStandard = outcomes.filter((outcome) => outcome.status === "filled" && standardFields.some((field) => field.id === outcome.fieldId));
  expect(filledStandard.length / standardFields.length).toBeGreaterThanOrEqual(0.9);

  expect((document.getElementById("first_name") as HTMLInputElement).value).toBe("Ada");
  expect((document.getElementById("notice") as HTMLSelectElement).value).toBe("1m");
  expect((document.getElementById("sponsorship") as HTMLSelectElement).value).toBe("no");
  const relocationYes = document.querySelector('input[name="relocation"][value="yes"]') as HTMLInputElement;
  expect(relocationYes.checked).toBe(true);
});

test("fills at least 90% of standard fields on the Lever fixture", () => {
  const document = loadFixture(resolve(process.cwd(), "tests/fixtures/html/lever/sample.html"));
  const fields = detectFields(document);
  const { matches } = matchFieldsHeuristically(fields);
  const values = flattenProfileValues(sampleProfile(), samplePreferences());
  const { outcomes } = fillFields(fields, matches, values);

  const standardFields = fields.filter((field) => field.kind !== "file" && field.kind !== "textarea");
  const filledStandard = outcomes.filter((outcome) => outcome.status === "filled" && standardFields.some((field) => field.id === outcome.fieldId));
  expect(filledStandard.length / standardFields.length).toBeGreaterThanOrEqual(0.9);

  expect((document.querySelector('input[name="email"]') as HTMLInputElement).value).toBe("ada@example.com");
  expect((document.querySelector('select[name="sponsorship"]') as HTMLSelectElement).value).toBe("n");
  expect((document.querySelector('input[name="location"]') as HTMLInputElement).value).toBe("London");
});

test("never fills a field that already has a value", () => {
  const document = loadFixture(resolve(process.cwd(), "tests/fixtures/html/greenhouse/sample.html"));
  (document.getElementById("email") as HTMLInputElement).value = "someone-else@example.com";
  const fields = detectFields(document);
  const { matches } = matchFieldsHeuristically(fields);
  const values = flattenProfileValues(sampleProfile(), samplePreferences());
  const { outcomes } = fillFields(fields, matches, values);
  const emailOutcome = outcomes.find((outcome) => outcome.fieldId === fields.find((field) => field.name.includes("email"))?.id);
  expect(emailOutcome?.status).toBe("skipped_not_empty");
  expect((document.getElementById("email") as HTMLInputElement).value).toBe("someone-else@example.com");
});

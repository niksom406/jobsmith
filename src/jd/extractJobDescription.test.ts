// @vitest-environment jsdom
import { expect, test } from "vitest";
import { extractCompanyName, extractJobDescription } from "./extractJobDescription";

test("prefers JSON-LD JobPosting over page content", () => {
  document.body.innerHTML = `
    <script type="application/ld+json">
      {"@type":"JobPosting","description":"<p>Build great software with us.</p>"}
    </script>
    <main>Some unrelated chrome around the posting.</main>
  `;
  const result = extractJobDescription(document);
  expect(result.source).toBe("json-ld");
  expect(result.text).toBe("Build great software with us.");
});

test("falls back to the largest content block when there is no JSON-LD", () => {
  document.body.innerHTML = `<main>${"We are hiring a software engineer to join our team. ".repeat(10)}</main>`;
  const result = extractJobDescription(document);
  expect(result.source).toBe("heuristic");
  expect(result.text.length).toBeGreaterThan(100);
});

test("reports none rather than guessing when nothing is found", () => {
  document.body.innerHTML = `<div>Short</div>`;
  const result = extractJobDescription(document);
  expect(result.source).toBe("none");
  expect(result.text).toBe("");
  expect(result.companyName).toBeNull();
});

test("reads the employer's name from JSON-LD hiringOrganization, not the ATS vendor", () => {
  document.body.innerHTML = `
    <script type="application/ld+json">
      {"@type":"JobPosting","description":"Build great software.","hiringOrganization":{"name":"Acme Robotics"}}
    </script>
  `;
  expect(extractCompanyName(document)).toBe("Acme Robotics");
  expect(extractJobDescription(document).companyName).toBe("Acme Robotics");
});

test("falls back to an 'at <Company>' pattern in the page title when there is no JSON-LD", () => {
  document.title = "Senior Engineer at Acme Robotics - Ashby";
  document.body.innerHTML = `<div>Short</div>`;
  expect(extractCompanyName(document)).toBe("Acme Robotics");
});

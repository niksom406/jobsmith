import { expect, test } from "vitest";
import { isAutomationBlocked, KNOWN_ATS, originPatternFromUrl } from "./access";

test("blocks LinkedIn and allows a Greenhouse board", () => {
  expect(isAutomationBlocked("https://www.linkedin.com/jobs/view/123")).toBe(true);
  expect(isAutomationBlocked("https://lnkd.in/abc")).toBe(true);
  expect(isAutomationBlocked("https://boards.greenhouse.io/acme/jobs/1")).toBe(false);
});

test("refuses a site pattern for a blocked host", () => {
  expect(originPatternFromUrl("https://www.linkedin.com/jobs/easy-apply")).toBeNull();
  expect(originPatternFromUrl("https://jobs.lever.co/acme/role")).toBe("https://jobs.lever.co/*");
});

test("known ATS toggles request a single host pattern, not every site", () => {
  for (const site of KNOWN_ATS) {
    expect(site.origins.length).toBeGreaterThan(0);
    for (const origin of site.origins) {
      expect(origin).not.toBe("<all_urls>");
      expect(origin.startsWith("https://")).toBe(true);
    }
  }
});

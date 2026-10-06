import type { AtsAdapter } from "./base";

/** Ashby application forms: plain inputs and selects; long-text questions are plain textareas. */
export const ashbyAdapter: AtsAdapter = {
  id: "ashby",
  matches: (hostname) => hostname.endsWith("ashbyhq.com"),
};

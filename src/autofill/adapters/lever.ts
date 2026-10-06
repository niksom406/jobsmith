import type { AtsAdapter } from "./base";

/** Lever application forms: mostly plain inputs, with a few native <select> dropdowns. */
export const leverAdapter: AtsAdapter = {
  id: "lever",
  matches: (hostname) => hostname.endsWith("lever.co"),
};

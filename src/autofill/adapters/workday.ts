import type { AtsAdapter } from "./base";

/**
 * Workday renders most fields as custom widgets (role="combobox" buttons rather than <select>, and a
 * multi-step wizard). Detection still finds native <input>/<select>/<textarea> elements Workday keeps for
 * plain text and simple pickers; its calendar and searchable-select widgets need the custom-dropdown
 * handling tracked for a later pass and are intentionally left for the user rather than guessed at.
 */
export const workdayAdapter: AtsAdapter = {
  id: "workday",
  matches: (hostname) => hostname.endsWith("myworkdayjobs.com") || hostname.includes(".wd1.myworkdayjobs.com"),
};

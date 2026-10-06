import type { AtsAdapter } from "./base";

/** SmartRecruiters application forms: standard inputs and selects. */
export const smartRecruitersAdapter: AtsAdapter = {
  id: "smartrecruiters",
  matches: (hostname) => hostname.endsWith("smartrecruiters.com"),
};

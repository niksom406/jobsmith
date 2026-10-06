import type { AtsAdapter } from "./base";

/** Greenhouse boards: standard HTML selects and inputs. react-select widgets are handled by customDropdown.ts. */
export const greenhouseAdapter: AtsAdapter = {
  id: "greenhouse",
  matches: (hostname) => hostname.endsWith("greenhouse.io"),
};

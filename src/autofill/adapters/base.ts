import type { DetectedField } from "../types";

export interface AtsAdapter {
  id: string;
  /** True if this adapter should handle the current page. */
  matches(hostname: string): boolean;
  /** Hook for site-specific quirks: open a custom dropdown panel before standard detection runs, etc. */
  prepare?(root: ParentNode): Promise<void>;
  /** Adjust or filter fields found by generic detection (e.g. ignore a site's hidden decoy inputs). */
  postProcess?(fields: DetectedField[]): DetectedField[];
}

export const genericAdapter: AtsAdapter = {
  id: "generic",
  matches: () => true,
};

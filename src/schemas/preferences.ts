import { z } from "zod";

export const PREFERENCES_VERSION = 1;

export const preferencesSchema = z.strictObject({
  schemaVersion: z.literal(PREFERENCES_VERSION),
  rightToWork: z.array(
    z.strictObject({
      country: z.string(),
      status: z.enum(["citizen", "settled", "visa", "other"]),
    }),
  ),
  sponsorshipNeeded: z.boolean().nullable(),
  noticePeriod: z.string(),
  salaryExpectation: z.strictObject({
    amount: z.string(),
    currency: z.string(),
    period: z.enum(["year", "month", "day", "hour"]),
  }),
  startDate: z.string(),
  relocation: z.enum(["yes", "no", "discuss"]),
  remotePreference: z.enum(["remote", "hybrid", "onsite", "flexible"]),
  willingnessToTravel: z.enum(["none", "occasional", "frequent"]),
  linkedin: z.string().optional(),
  github: z.string().optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export function createEmptyPreferences(): Preferences {
  return {
    schemaVersion: PREFERENCES_VERSION,
    rightToWork: [],
    sponsorshipNeeded: null,
    noticePeriod: "",
    salaryExpectation: { amount: "", currency: "GBP", period: "year" },
    startDate: "",
    relocation: "discuss",
    remotePreference: "flexible",
    willingnessToTravel: "occasional",
    linkedin: "",
    github: "",
  };
}

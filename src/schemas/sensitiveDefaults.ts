import { z } from "zod";

export const SENSITIVE_DEFAULTS_VERSION = 1;

export const sensitiveCategoryIds = [
  "gender",
  "ethnicity",
  "disability",
  "veteran",
  "sexualOrientation",
  "religion",
  "dateOfBirth",
] as const;

export const sensitiveCategorySchema = z.enum(sensitiveCategoryIds);

export const sensitiveChoiceSchema = z.strictObject({
  mode: z.enum(["ask_every_time", "prefer_not_to_say", "use_saved_answer"]),
  savedValue: z.string(),
});

const choice = () => sensitiveChoiceSchema;

export const sensitiveDefaultsSchema = z.strictObject({
  schemaVersion: z.literal(SENSITIVE_DEFAULTS_VERSION),
  categories: z.strictObject({
    gender: choice(),
    ethnicity: choice(),
    disability: choice(),
    veteran: choice(),
    sexualOrientation: choice(),
    religion: choice(),
    dateOfBirth: choice(),
  }),
});

export type SensitiveCategoryId = z.infer<typeof sensitiveCategorySchema>;
export type SensitiveChoice = z.infer<typeof sensitiveChoiceSchema>;
export type SensitiveDefaults = z.infer<typeof sensitiveDefaultsSchema>;

export const sensitiveCategoryLabels: Record<SensitiveCategoryId, string> = {
  gender: "Gender",
  ethnicity: "Ethnicity",
  disability: "Disability",
  veteran: "Veteran status",
  sexualOrientation: "Sexual orientation",
  religion: "Religion",
  dateOfBirth: "Age or date of birth",
};

function askEveryTime(): SensitiveChoice {
  return { mode: "ask_every_time", savedValue: "" };
}

export function createEmptySensitiveDefaults(): SensitiveDefaults {
  return {
    schemaVersion: SENSITIVE_DEFAULTS_VERSION,
    categories: {
      gender: askEveryTime(),
      ethnicity: askEveryTime(),
      disability: askEveryTime(),
      veteran: askEveryTime(),
      sexualOrientation: askEveryTime(),
      religion: askEveryTime(),
      dateOfBirth: askEveryTime(),
    },
  };
}

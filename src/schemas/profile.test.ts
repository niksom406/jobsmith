import { expect, test } from "vitest";
import { createEmptyProfile, profileSchema } from "./profile";
import { createEmptySensitiveDefaults, sensitiveDefaultsSchema } from "./sensitiveDefaults";
import { createDefaultSettings, settingsSchema } from "./settings";

test("accepts an empty profile and rejects extra keys", () => {
  expect(profileSchema.parse(createEmptyProfile()).name).toBe("");
  const extra = { ...createEmptyProfile(), nickname: "A" };
  expect(profileSchema.safeParse(extra).success).toBe(false);
});

test("sensitive defaults ask every time", () => {
  const defaults = sensitiveDefaultsSchema.parse(createEmptySensitiveDefaults());
  expect(defaults.categories.gender.mode).toBe("ask_every_time");
  expect(defaults.categories.dateOfBirth.mode).toBe("ask_every_time");
});

test("settings default to the configured models", () => {
  const settings = settingsSchema.parse(createDefaultSettings());
  expect(settings.models.parse).toBe("gpt-6-luna");
  expect(settings.models.answer).toBe("gpt-6-luna");
  expect(settings.models.answerBetter).toBe("gpt-6.1-sol");
  expect(settings.betterQuality).toBe(false);
  expect(settings.language).toBe("en-GB");
  expect(settings.apiKey).toBe("");
});

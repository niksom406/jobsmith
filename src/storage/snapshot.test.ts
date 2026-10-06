import { expect, test } from "vitest";
import { createEmptyPreferences } from "../schemas/preferences";
import { createEmptyProfile } from "../schemas/profile";
import { createEmptySensitiveDefaults } from "../schemas/sensitiveDefaults";
import { createDefaultSettings } from "../schemas/settings";
import { buildExportFile, parseExportFile } from "./snapshot";

const base = {
  settings: { ...createDefaultSettings(), apiKey: "sk-test" },
  profile: createEmptyProfile(),
  preferences: createEmptyPreferences(),
  sensitiveDefaults: createEmptySensitiveDefaults(),
  documents: [],
  answerBank: [],
  companyCache: [],
  applications: [],
  exportedAt: "2026-10-06T12:00:00.000Z",
};

test("export omits the API key unless asked", async () => {
  const withoutKey = await buildExportFile({ ...base, includeApiKey: false });
  expect(withoutKey.local.settings.apiKey).toBe("");
  const withKey = await buildExportFile({ ...base, includeApiKey: true });
  expect(withKey.local.settings.apiKey).toBe("sk-test");
});

test("import rejects an unknown export version", () => {
  expect(() => parseExportFile({ exportVersion: 2 })).toThrow();
});

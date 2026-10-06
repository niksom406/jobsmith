import { createEmptyPreferences } from "./preferences";
import { createEmptyProfile } from "./profile";
import { createEmptySensitiveDefaults, sensitiveCategoryIds, SENSITIVE_DEFAULTS_VERSION } from "./sensitiveDefaults";
import { createDefaultSettings } from "./settings";
import type { Migration } from "./migrations";

function stampVersion(fallback: { schemaVersion: number }): Migration {
  return (value) => {
    const record = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
    return structuredClone({ ...fallback, ...record, schemaVersion: fallback.schemaVersion });
  };
}

export const profileMigrations: Record<number, Migration> = {
  0: stampVersion(createEmptyProfile()),
};

export const preferencesMigrations: Record<number, Migration> = {
  0: stampVersion(createEmptyPreferences()),
};

export const settingsMigrations: Record<number, Migration> = {
  0: stampVersion(createDefaultSettings()),
};

/** v1 categories had no `encrypted` flag; stamp it false and leave `savedValue` as plain text. */
function addEncryptedFlag(value: unknown): unknown {
  const record = value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const categoriesRecord =
    record.categories !== null && typeof record.categories === "object" ? (record.categories as Record<string, unknown>) : {};
  const categories: Record<string, unknown> = {};
  for (const id of sensitiveCategoryIds) {
    const choiceRecord = categoriesRecord[id] !== null && typeof categoriesRecord[id] === "object" ? (categoriesRecord[id] as Record<string, unknown>) : {};
    categories[id] = {
      mode: choiceRecord.mode ?? "ask_every_time",
      savedValue: choiceRecord.savedValue ?? "",
      encrypted: choiceRecord.encrypted ?? false,
    };
  }
  return { ...record, categories, schemaVersion: SENSITIVE_DEFAULTS_VERSION };
}

export const sensitiveDefaultsMigrations: Record<number, Migration> = {
  0: stampVersion(createEmptySensitiveDefaults()),
  1: addEncryptedFlag,
};

import { createEmptyPreferences } from "./preferences";
import { createEmptyProfile } from "./profile";
import { createEmptySensitiveDefaults } from "./sensitiveDefaults";
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

export const sensitiveDefaultsMigrations: Record<number, Migration> = {
  0: stampVersion(createEmptySensitiveDefaults()),
};

import { expect, test } from "vitest";
import { migrateRecord } from "./migrations";
import { sensitiveDefaultsMigrations } from "./migrateEntities";
import { SENSITIVE_DEFAULTS_VERSION, sensitiveDefaultsSchema } from "./sensitiveDefaults";

test("migrates a version 1 record (no encrypted flag) up to the current schema", () => {
  const old = {
    schemaVersion: 1,
    categories: {
      gender: { mode: "use_saved_answer", savedValue: "Non-binary" },
      ethnicity: { mode: "ask_every_time", savedValue: "" },
      disability: { mode: "ask_every_time", savedValue: "" },
      veteran: { mode: "ask_every_time", savedValue: "" },
      sexualOrientation: { mode: "ask_every_time", savedValue: "" },
      religion: { mode: "ask_every_time", savedValue: "" },
      dateOfBirth: { mode: "ask_every_time", savedValue: "" },
    },
  };
  const migrated = migrateRecord(old, sensitiveDefaultsMigrations, SENSITIVE_DEFAULTS_VERSION);
  const parsed = sensitiveDefaultsSchema.parse(migrated);
  expect(parsed.schemaVersion).toBe(2);
  expect(parsed.categories.gender).toEqual({ mode: "use_saved_answer", savedValue: "Non-binary", encrypted: false });
});

test("a brand new record starts fully on the current schema", () => {
  const migrated = migrateRecord({}, sensitiveDefaultsMigrations, SENSITIVE_DEFAULTS_VERSION);
  const parsed = sensitiveDefaultsSchema.parse(migrated);
  expect(parsed.categories.gender.encrypted).toBe(false);
});

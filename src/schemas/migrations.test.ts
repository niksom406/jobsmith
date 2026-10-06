import { expect, test } from "vitest";
import { migrateRecord, StorageMigrationError } from "./migrations";
import { profileMigrations } from "./migrateEntities";
import { PROFILE_VERSION, profileSchema } from "./profile";

test("migrates a version 0 profile up to the current schema", () => {
  const migrated = migrateRecord({ name: "Ada Lovelace" }, profileMigrations, PROFILE_VERSION);
  const profile = profileSchema.parse(migrated);
  expect(profile.schemaVersion).toBe(1);
  expect(profile.name).toBe("Ada Lovelace");
  expect(profile.skills).toEqual([]);
});

test("rejects stored data newer than this extension", () => {
  expect(() => migrateRecord({ schemaVersion: 9 }, profileMigrations, PROFILE_VERSION)).toThrow(StorageMigrationError);
});

test("leaves the current version untouched", () => {
  const current = { schemaVersion: 1, name: "Grace Hopper" };
  expect(migrateRecord(current, profileMigrations, PROFILE_VERSION)).toEqual(current);
});

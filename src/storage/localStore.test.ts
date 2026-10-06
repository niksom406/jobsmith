import { expect, test } from "vitest";
import { profileMigrations } from "../schemas/migrateEntities";
import { createEmptyProfile, profileSchema } from "../schemas/profile";
import { createMemoryArea, loadStored, saveStored } from "./localStore";

test("missing keys return the fallback and do not write it", async () => {
  const area = createMemoryArea();
  const loaded = await loadStored(area, "profile", profileSchema, profileMigrations, createEmptyProfile());
  expect(loaded.ok).toBe(true);
  if (loaded.ok) expect(loaded.value.name).toBe("");
  expect(area.snapshot()).toEqual({});
});

test("invalid stored profiles are returned, not replaced", async () => {
  const area = createMemoryArea({ profile: { schemaVersion: 1, name: 12 } });
  const loaded = await loadStored(area, "profile", profileSchema, profileMigrations, createEmptyProfile());
  expect(loaded.ok).toBe(false);
  expect(area.snapshot().profile).toEqual({ schemaVersion: 1, name: 12 });
});

test("save writes a validated profile", async () => {
  const area = createMemoryArea();
  const profile = { ...createEmptyProfile(), name: "Ada Lovelace", email: "ada@example.com" };
  await saveStored(area, "profile", profileSchema, profile);
  const loaded = await loadStored(area, "profile", profileSchema, profileMigrations, createEmptyProfile());
  expect(loaded.ok && loaded.value.name).toBe("Ada Lovelace");
});

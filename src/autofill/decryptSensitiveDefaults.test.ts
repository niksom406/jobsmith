import { afterEach, expect, test } from "vitest";
import { createEmptySensitiveDefaults } from "../schemas/sensitiveDefaults";
import { encryptWithPassphrase } from "../storage/crypto";
import { clearSessionPassphrase, setSessionPassphrase } from "../storage/sessionPassphrase";
import { decryptSensitiveDefaultsForFill } from "./decryptSensitiveDefaults";

afterEach(async () => {
  await clearSessionPassphrase();
});

test("decrypts a saved value when the right passphrase is cached for this session", async () => {
  const encrypted = await encryptWithPassphrase("Non-binary", "a passphrase");
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.gender = { mode: "use_saved_answer", savedValue: JSON.stringify(encrypted), encrypted: true };
  await setSessionPassphrase("a passphrase");

  const result = await decryptSensitiveDefaultsForFill(defaults);
  expect(result.categories.gender).toEqual({ mode: "use_saved_answer", savedValue: "Non-binary", encrypted: false });
});

test("falls back to ask-every-time instead of filling anything when no passphrase is cached", async () => {
  const encrypted = await encryptWithPassphrase("Non-binary", "a passphrase");
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.gender = { mode: "use_saved_answer", savedValue: JSON.stringify(encrypted), encrypted: true };

  const result = await decryptSensitiveDefaultsForFill(defaults);
  expect(result.categories.gender).toEqual({ mode: "ask_every_time", savedValue: "", encrypted: false });
});

test("falls back to ask-every-time, not a guess, when the cached passphrase is wrong", async () => {
  const encrypted = await encryptWithPassphrase("Non-binary", "a passphrase");
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.gender = { mode: "use_saved_answer", savedValue: JSON.stringify(encrypted), encrypted: true };
  await setSessionPassphrase("the wrong passphrase");

  const result = await decryptSensitiveDefaultsForFill(defaults);
  expect(result.categories.gender).toEqual({ mode: "ask_every_time", savedValue: "", encrypted: false });
});

test("leaves unencrypted categories untouched", async () => {
  const defaults = createEmptySensitiveDefaults();
  defaults.categories.religion = { mode: "use_saved_answer", savedValue: "Prefer not to say", encrypted: false };

  const result = await decryptSensitiveDefaultsForFill(defaults);
  expect(result.categories.religion).toEqual({ mode: "use_saved_answer", savedValue: "Prefer not to say", encrypted: false });
});

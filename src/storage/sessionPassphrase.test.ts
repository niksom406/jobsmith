import { afterEach, expect, test } from "vitest";
import { clearSessionPassphrase, getSessionPassphrase, setSessionPassphrase } from "./sessionPassphrase";

afterEach(async () => {
  await clearSessionPassphrase();
});

test("round-trips a passphrase through the in-memory fallback used outside a real extension", async () => {
  expect(await getSessionPassphrase()).toBeNull();
  await setSessionPassphrase("correct horse battery staple");
  expect(await getSessionPassphrase()).toBe("correct horse battery staple");
  await clearSessionPassphrase();
  expect(await getSessionPassphrase()).toBeNull();
});

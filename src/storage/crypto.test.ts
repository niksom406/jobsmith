import { expect, test } from "vitest";
import { decryptWithPassphrase, DecryptionError, encryptWithPassphrase } from "./crypto";

test("round-trips a value with the correct passphrase", async () => {
  const encrypted = await encryptWithPassphrase("non-binary", "correct horse battery staple");
  const plain = await decryptWithPassphrase(encrypted, "correct horse battery staple");
  expect(plain).toBe("non-binary");
});

test("rejects the wrong passphrase instead of returning garbage", async () => {
  const encrypted = await encryptWithPassphrase("non-binary", "right passphrase");
  await expect(decryptWithPassphrase(encrypted, "wrong passphrase")).rejects.toThrow(DecryptionError);
});

test("never stores the plain text in the encrypted record", async () => {
  const encrypted = await encryptWithPassphrase("a secret value", "a passphrase");
  expect(JSON.stringify(encrypted)).not.toContain("a secret value");
});

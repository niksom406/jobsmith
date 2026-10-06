import { bytesToBase64, base64ToBytes } from "./bytes";

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedValue {
  cipherTextBase64: string;
  saltBase64: string;
  ivBase64: string;
  iterations: number;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWithPassphrase(plainText: string, passphrase: string): Promise<EncryptedValue> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const cipherText = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText));
  return {
    cipherTextBase64: bytesToBase64(new Uint8Array(cipherText)),
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    iterations: PBKDF2_ITERATIONS,
  };
}

export class DecryptionError extends Error {
  constructor() {
    super("That passphrase did not unlock this value.");
    this.name = "DecryptionError";
  }
}

export async function decryptWithPassphrase(value: EncryptedValue, passphrase: string): Promise<string> {
  const salt = base64ToBytes(value.saltBase64);
  const iv = base64ToBytes(value.ivBase64);
  const key = await deriveKey(passphrase, salt, value.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      new Uint8Array(base64ToBytes(value.cipherTextBase64)),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new DecryptionError();
  }
}

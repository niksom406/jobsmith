import { decryptWithPassphrase, type EncryptedValue } from "../storage/crypto";
import { getSessionPassphrase } from "../storage/sessionPassphrase";
import { sensitiveCategoryIds, type SensitiveDefaults } from "../schemas/sensitiveDefaults";

/**
 * Decrypts "use a saved answer" sensitive values that were stored encrypted, using whatever passphrase
 * is cached for this browser session (set from Options → Sensitive). Never persists the passphrase or
 * the decrypted text anywhere — the result is used in memory for one fill and then discarded. A category
 * that can't be decrypted (no cached passphrase, or a stale/wrong one) falls back to "ask every time"
 * rather than filling nothing-matches-the-schema garbage or, worse, a wrong value.
 */
export async function decryptSensitiveDefaultsForFill(defaults: SensitiveDefaults): Promise<SensitiveDefaults> {
  const needsDecryption = sensitiveCategoryIds.some((id) => defaults.categories[id].encrypted && defaults.categories[id].mode === "use_saved_answer");
  if (!needsDecryption) return defaults;

  const passphrase = await getSessionPassphrase();
  const categories = { ...defaults.categories };

  for (const id of sensitiveCategoryIds) {
    const choice = categories[id];
    if (!choice.encrypted || choice.mode !== "use_saved_answer") continue;

    if (!passphrase) {
      categories[id] = { mode: "ask_every_time", savedValue: "", encrypted: false };
      continue;
    }
    try {
      const encrypted = JSON.parse(choice.savedValue) as EncryptedValue;
      const plainText = await decryptWithPassphrase(encrypted, passphrase);
      categories[id] = { mode: "use_saved_answer", savedValue: plainText, encrypted: false };
    } catch {
      categories[id] = { mode: "ask_every_time", savedValue: "", encrypted: false };
    }
  }

  return { ...defaults, categories };
}

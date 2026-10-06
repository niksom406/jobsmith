const SESSION_KEY = "jobsmith.sensitivePassphrase";

/**
 * Used only when a passphrase is needed in an environment without `chrome.storage.session` (unit tests,
 * or a very old Chrome). It lives only in this module's memory, never written to disk, and disappears
 * the moment the process ends — the same lifetime `chrome.storage.session` gives in the real extension.
 */
let memoryFallback: string | null = null;

function sessionArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.session) return null;
  return chrome.storage.session;
}

/** Caches the passphrase for this browser session only — never `chrome.storage.local`, never Dexie. */
export async function setSessionPassphrase(passphrase: string): Promise<void> {
  const area = sessionArea();
  if (!area) {
    memoryFallback = passphrase;
    return;
  }
  await area.set({ [SESSION_KEY]: passphrase });
}

export async function getSessionPassphrase(): Promise<string | null> {
  const area = sessionArea();
  if (!area) return memoryFallback;
  const stored = await area.get(SESSION_KEY);
  const value = (stored as Record<string, unknown>)[SESSION_KEY];
  return typeof value === "string" ? value : null;
}

export async function clearSessionPassphrase(): Promise<void> {
  const area = sessionArea();
  if (!area) {
    memoryFallback = null;
    return;
  }
  await area.remove(SESSION_KEY);
}

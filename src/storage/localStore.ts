import type { ZodType } from "zod";
import { migrateRecord, type Migration } from "../schemas/migrations";

export interface KeyValueArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  getAll(): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; error: string; raw: unknown };

export const LOCAL_KEYS = {
  profile: "profile",
  preferences: "preferences",
  settings: "settings",
  sensitiveDefaults: "sensitiveDefaults",
  fieldOverrides: "fieldOverrides",
} as const;

export function createMemoryArea(initial: Record<string, unknown> = {}): KeyValueArea & {
  snapshot(): Record<string, unknown>;
} {
  const data: Record<string, unknown> = { ...initial };
  return {
    async get(keys) {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in data) result[key] = structuredClone(data[key]);
      }
      return result;
    },
    async getAll() {
      return structuredClone(data);
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      for (const key of keys) delete data[key];
    },
    async clear() {
      for (const key of Object.keys(data)) delete data[key];
    },
    snapshot() {
      return structuredClone(data);
    },
  };
}

export const chromeLocalArea: KeyValueArea = {
  get(keys) {
    return chrome.storage.local.get(keys) as Promise<Record<string, unknown>>;
  },
  getAll() {
    return chrome.storage.local.get(null) as Promise<Record<string, unknown>>;
  },
  async set(items) {
    await chrome.storage.local.set(items);
  },
  async remove(keys) {
    await chrome.storage.local.remove(keys);
  },
  async clear() {
    await chrome.storage.local.clear();
  },
};

export function extensionStorageAvailable(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

let memoryFallback: KeyValueArea | null = null;

/** Extension storage when this page is running inside Chrome, otherwise a tab-local stand-in. */
export function activeArea(): KeyValueArea {
  if (extensionStorageAvailable()) return chromeLocalArea;
  memoryFallback ??= createMemoryArea();
  return memoryFallback;
}

export async function loadStored<T extends { schemaVersion: number }>(
  area: KeyValueArea,
  key: string,
  schema: ZodType<T>,
  migrations: Record<number, Migration>,
  fallback: T,
): Promise<LoadResult<T>> {
  const stored = await area.get([key]);
  if (!(key in stored) || stored[key] == null) {
    return { ok: true, value: fallback };
  }

  try {
    const migrated = migrateRecord(stored[key], migrations, fallback.schemaVersion);
    const parsed = schema.safeParse(migrated);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
        raw: stored[key],
      };
    }
    return { ok: true, value: parsed.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read stored data.",
      raw: stored[key],
    };
  }
}

export async function saveStored<T>(area: KeyValueArea, key: string, schema: ZodType<T>, value: T): Promise<T> {
  const parsed = schema.parse(value);
  await area.set({ [key]: parsed });
  return parsed;
}

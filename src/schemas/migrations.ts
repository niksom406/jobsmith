export class StorageMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageMigrationError";
  }
}

export type Migration = (value: unknown) => unknown;

/**
 * Walk a stored record from its schemaVersion up to `target`.
 * Missing data is not passed here — callers use the empty default instead.
 */
export function migrateRecord(raw: unknown, migrations: Record<number, Migration>, target: number): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new StorageMigrationError("Stored value is not an object.");
  }

  let current = raw as Record<string, unknown>;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : 0;

  if (version > target) {
    throw new StorageMigrationError(
      `Stored data is version ${version}, which is newer than this extension (version ${target}).`,
    );
  }

  while (version < target) {
    const step = migrations[version];
    if (!step) {
      throw new StorageMigrationError(`No migration from version ${version}.`);
    }
    const next = step(current);
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      throw new StorageMigrationError(`Migration from version ${version} did not return an object.`);
    }
    current = next as Record<string, unknown>;
    const nextVersion = current.schemaVersion;
    if (typeof nextVersion !== "number" || nextVersion <= version) {
      throw new StorageMigrationError(`Migration from version ${version} did not advance schemaVersion.`);
    }
    version = nextVersion;
  }

  return current;
}

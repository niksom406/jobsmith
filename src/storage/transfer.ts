import { answerBankSchema } from "../schemas/answerBank";
import { applicationSchema } from "../schemas/applications";
import { companyCacheSchema } from "../schemas/companyCache";
import { preferencesMigrations } from "../schemas/migrateEntities";
import { preferencesSchema } from "../schemas/preferences";
import { profileMigrations } from "../schemas/migrateEntities";
import { profileSchema } from "../schemas/profile";
import { sensitiveDefaultsMigrations } from "../schemas/migrateEntities";
import { sensitiveDefaultsSchema } from "../schemas/sensitiveDefaults";
import { settingsMigrations } from "../schemas/migrateEntities";
import { settingsSchema } from "../schemas/settings";
import { createEmptyPreferences } from "../schemas/preferences";
import { createEmptyProfile } from "../schemas/profile";
import { createEmptySensitiveDefaults } from "../schemas/sensitiveDefaults";
import { createDefaultSettings } from "../schemas/settings";
import { db } from "./db";
import { blobToBase64 } from "./bytes";
import { LOCAL_KEYS, chromeLocalArea, loadStored, saveStored, type KeyValueArea, type LoadResult } from "./localStore";
import { buildExportFile, documentsFromExport, parseExportFile, type ExportFile } from "./snapshot";

export interface LocalBundle {
  profile: LoadResult<ReturnType<typeof createEmptyProfile>>;
  preferences: LoadResult<ReturnType<typeof createEmptyPreferences>>;
  settings: LoadResult<ReturnType<typeof createDefaultSettings>>;
  sensitiveDefaults: LoadResult<ReturnType<typeof createEmptySensitiveDefaults>>;
}

export async function loadLocalBundle(area: KeyValueArea = chromeLocalArea): Promise<LocalBundle> {
  const [profile, preferences, settings, sensitiveDefaults] = await Promise.all([
    loadStored(area, LOCAL_KEYS.profile, profileSchema, profileMigrations, createEmptyProfile()),
    loadStored(area, LOCAL_KEYS.preferences, preferencesSchema, preferencesMigrations, createEmptyPreferences()),
    loadStored(area, LOCAL_KEYS.settings, settingsSchema, settingsMigrations, createDefaultSettings()),
    loadStored(
      area,
      LOCAL_KEYS.sensitiveDefaults,
      sensitiveDefaultsSchema,
      sensitiveDefaultsMigrations,
      createEmptySensitiveDefaults(),
    ),
  ]);
  return { profile, preferences, settings, sensitiveDefaults };
}

function assertOk<T>(result: LoadResult<T>, label: string): T {
  if (!result.ok) {
    throw new Error(`${label} could not be read (${result.error}). Download a raw backup before replacing it.`);
  }
  return result.value;
}

export async function exportAll(includeApiKey: boolean, area: KeyValueArea = chromeLocalArea): Promise<ExportFile> {
  const bundle = await loadLocalBundle(area);
  const [documents, answerBank, companyCache, applications] = await Promise.all([
    db.documents.toArray(),
    db.answerBank.toArray(),
    db.companyCache.toArray(),
    db.applications.toArray(),
  ]);

  return buildExportFile({
    settings: assertOk(bundle.settings, "Settings"),
    profile: assertOk(bundle.profile, "Profile"),
    preferences: assertOk(bundle.preferences, "Preferences"),
    sensitiveDefaults: assertOk(bundle.sensitiveDefaults, "Sensitive field defaults"),
    documents,
    answerBank,
    companyCache,
    applications,
    includeApiKey,
  });
}

export async function importAll(raw: unknown, area: KeyValueArea = chromeLocalArea): Promise<ExportFile> {
  const file = parseExportFile(raw);
  const documents = documentsFromExport(file);

  await saveStored(area, LOCAL_KEYS.settings, settingsSchema, file.local.settings);
  await saveStored(area, LOCAL_KEYS.profile, profileSchema, file.local.profile);
  await saveStored(area, LOCAL_KEYS.preferences, preferencesSchema, file.local.preferences);
  await saveStored(area, LOCAL_KEYS.sensitiveDefaults, sensitiveDefaultsSchema, file.local.sensitiveDefaults);

  await db.transaction("rw", [db.documents, db.answerBank, db.companyCache, db.applications], async () => {
    await Promise.all([
      db.documents.clear(),
      db.answerBank.clear(),
      db.companyCache.clear(),
      db.applications.clear(),
    ]);
    await db.documents.bulkAdd(documents);
    await db.answerBank.bulkAdd(file.indexedDb.answerBank.map((entry) => answerBankSchema.parse(entry)));
    await db.companyCache.bulkAdd(file.indexedDb.companyCache.map((entry) => companyCacheSchema.parse(entry)));
    await db.applications.bulkAdd(file.indexedDb.applications.map((entry) => applicationSchema.parse(entry)));
  });

  return file;
}

export async function deleteAllData(area: KeyValueArea = chromeLocalArea): Promise<void> {
  await area.clear();
  await db.documents.clear();
  await db.answerBank.clear();
  await db.companyCache.clear();
  await db.applications.clear();
}

export async function dumpRaw(area: KeyValueArea = chromeLocalArea): Promise<unknown> {
  const local = await area.getAll();
  const [documents, answerBank, companyCache, applications] = await Promise.all([
    db.documents.toArray(),
    db.answerBank.toArray(),
    db.companyCache.toArray(),
    db.applications.toArray(),
  ]);
  return {
    warning: "Raw backup. It includes your API key and any stored files, including values that failed validation.",
    local,
    indexedDb: {
      documents: await Promise.all(
        documents.map(async (document) => ({
          id: document.id,
          schemaVersion: document.schemaVersion,
          kind: document.kind,
          fileName: document.fileName,
          mimeType: document.mimeType,
          parsedText: document.parsedText,
          createdAt: document.createdAt,
          dataBase64: await blobToBase64(document.blob),
        })),
      ),
      answerBank,
      companyCache,
      applications,
    },
  };
}

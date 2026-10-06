import { z } from "zod";
import { answerBankSchema, type AnswerBankEntry } from "../schemas/answerBank";
import { applicationSchema, type ApplicationRecord } from "../schemas/applications";
import { companyCacheSchema, type CompanyCacheEntry } from "../schemas/companyCache";
import { documentExportSchema, type DocumentExport, type DocumentRecord } from "../schemas/documents";
import { preferencesSchema, type Preferences } from "../schemas/preferences";
import { profileSchema, type Profile } from "../schemas/profile";
import { sensitiveDefaultsSchema, type SensitiveDefaults } from "../schemas/sensitiveDefaults";
import { settingsSchema, type Settings } from "../schemas/settings";
import { base64ToBlob, blobToBase64 } from "./bytes";

export const EXPORT_VERSION = 1;

export const exportFileSchema = z.strictObject({
  exportVersion: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  local: z.strictObject({
    settings: settingsSchema,
    profile: profileSchema,
    preferences: preferencesSchema,
    sensitiveDefaults: sensitiveDefaultsSchema,
  }),
  indexedDb: z.strictObject({
    documents: z.array(documentExportSchema),
    answerBank: z.array(answerBankSchema),
    companyCache: z.array(companyCacheSchema),
    applications: z.array(applicationSchema),
  }),
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export interface SnapshotInput {
  settings: Settings;
  profile: Profile;
  preferences: Preferences;
  sensitiveDefaults: SensitiveDefaults;
  documents: DocumentRecord[];
  answerBank: AnswerBankEntry[];
  companyCache: CompanyCacheEntry[];
  applications: ApplicationRecord[];
  includeApiKey: boolean;
  exportedAt?: string;
}

export async function buildExportFile(input: SnapshotInput): Promise<ExportFile> {
  const documents: DocumentExport[] = [];
  for (const document of input.documents) {
    documents.push({
      id: document.id,
      schemaVersion: document.schemaVersion,
      kind: document.kind,
      fileName: document.fileName,
      mimeType: document.mimeType,
      parsedText: document.parsedText,
      createdAt: document.createdAt,
      dataBase64: await blobToBase64(document.blob),
    });
  }

  const file: ExportFile = {
    exportVersion: EXPORT_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    local: {
      settings: {
        ...input.settings,
        apiKey: input.includeApiKey ? input.settings.apiKey : "",
      },
      profile: input.profile,
      preferences: input.preferences,
      sensitiveDefaults: input.sensitiveDefaults,
    },
    indexedDb: {
      documents,
      answerBank: input.answerBank,
      companyCache: input.companyCache,
      applications: input.applications,
    },
  };

  return exportFileSchema.parse(file);
}

export function parseExportFile(raw: unknown): ExportFile {
  return exportFileSchema.parse(raw);
}

export function documentsFromExport(file: ExportFile): DocumentRecord[] {
  return file.indexedDb.documents.map((document) => ({
    id: document.id,
    schemaVersion: document.schemaVersion,
    kind: document.kind,
    fileName: document.fileName,
    mimeType: document.mimeType,
    parsedText: document.parsedText,
    createdAt: document.createdAt,
    blob: base64ToBlob(document.dataBase64, document.mimeType),
  }));
}

import Dexie, { type Table } from "dexie";
import type { AnswerBankEntry } from "../schemas/answerBank";
import type { ApplicationRecord } from "../schemas/applications";
import type { CompanyCacheEntry } from "../schemas/companyCache";
import type { DocumentRecord } from "../schemas/documents";

export class JobsmithDB extends Dexie {
  documents!: Table<DocumentRecord, string>;
  answerBank!: Table<AnswerBankEntry, string>;
  companyCache!: Table<CompanyCacheEntry, string>;
  applications!: Table<ApplicationRecord, string>;

  constructor() {
    super("jobsmith");
    this.version(1).stores({
      documents: "id, kind, createdAt",
      answerBank: "id, normalizedQuestion, updatedAt",
      companyCache: "domain, fetchedAt",
      applications: "id, date, company",
    });
  }
}

export const db = new JobsmithDB();

import { afterEach, expect, test } from "vitest";
import { db } from "./db";
import { createMemoryArea } from "./localStore";
import { deleteAllData, exportAll, importAll } from "./transfer";

afterEach(async () => {
  await db.documents.clear();
  await db.answerBank.clear();
  await db.companyCache.clear();
  await db.applications.clear();
});

test("export and import round-trip a document and then delete everything", async () => {
  const area = createMemoryArea();
  await db.documents.add({
    id: "cv-1",
    schemaVersion: 1,
    kind: "cv",
    fileName: "cv.txt",
    mimeType: "text/plain",
    parsedText: "Built a compiler.",
    createdAt: "2026-10-06T00:00:00.000Z",
    blob: new Blob(["Built a compiler."], { type: "text/plain" }),
  });
  await db.answerBank.add({
    id: "ans-1",
    schemaVersion: 1,
    normalizedQuestion: "notice period",
    originalQuestion: "What is your notice period?",
    answer: "4 weeks",
    fieldType: "text",
    company: "Acme",
    role: "Engineer",
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T00:00:00.000Z",
    lastUsedAt: null,
  });

  const file = await exportAll(false, area);
  expect(file.indexedDb.documents).toHaveLength(1);
  expect(file.indexedDb.answerBank[0]?.answer).toBe("4 weeks");

  await db.documents.clear();
  await db.answerBank.clear();
  await importAll(file, area);

  const restored = await db.documents.get("cv-1");
  expect(restored?.parsedText).toBe("Built a compiler.");
  expect(await restored?.blob.text()).toBe("Built a compiler.");
  expect(await db.answerBank.count()).toBe(1);

  await deleteAllData(area);
  expect(area.snapshot()).toEqual({});
  expect(await db.documents.count()).toBe(0);
  expect(await db.answerBank.count()).toBe(0);
});

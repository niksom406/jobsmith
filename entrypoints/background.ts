import { normalizeQuestion } from "../src/answerBank/matching";
import { mapUnmatchedFields } from "../src/llm/prompts/mapFields";
import { testOpenAiConnection } from "../src/llm/testConnection";
import { getAnswerBankRequestSchema, saveAnswerRequestSchema } from "../src/messaging/answerBankTypes";
import { draftAnswersRequestSchema } from "../src/messaging/draftTypes";
import { getCvFileRequestSchema } from "../src/messaging/documentTypes";
import { blobToBase64 } from "../src/storage/bytes";
import { mapFieldsRequestSchema } from "../src/messaging/mapFieldsTypes";
import { testConnectionRequestSchema, testConnectionResultSchema } from "../src/messaging/types";
import { draftFieldAnswerRequestSchema } from "../src/messaging/draftFieldTypes";
import {
  deleteApplicationRequestSchema,
  listApplicationsRequestSchema,
  updateApplicationStatusRequestSchema,
  upsertApplicationRequestSchema,
} from "../src/messaging/applicationTypes";
import { createDefaultSettings, settingsSchema } from "../src/schemas/settings";
import { createEmptyProfile, profileSchema } from "../src/schemas/profile";
import { chromeLocalArea, LOCAL_KEYS } from "../src/storage/localStore";
import { db } from "../src/storage/db";
import { handleDraftAnswersRequest } from "../src/llm/prompts/handleDraftAnswers";
import { handleDraftCoverLetterRequest } from "../src/llm/prompts/handleDraftCoverLetter";
import { draftCoverLetterRequestSchema } from "../src/messaging/coverLetterTypes";
import { draftAnswerVariants } from "../src/llm/prompts/draftAnswer";
import { getCompanyBrief } from "../src/company/companyBrief";
import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older browsers without this call still open the panel from the toolbar menu.
  });

  // chrome.storage.session defaults to extension-pages-only; the content script needs to read the cached
  // sensitive-value passphrase too (never the API key — that's only ever read in this service worker).
  void chrome.storage.session?.setAccessLevel?.({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => {
    // Older Chrome without chrome.storage.session: src/storage/sessionPassphrase.ts falls back to an
    // in-memory cache scoped to whichever context set it, so encryption still works within one page.
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const connectionTest = testConnectionRequestSchema.safeParse(message);
    if (connectionTest.success) {
      void testOpenAiConnection(connectionTest.data.payload.apiKey, connectionTest.data.payload.model).then((result) => {
        sendResponse(testConnectionResultSchema.parse(result));
      });
      return true;
    }

    const saveAnswer = saveAnswerRequestSchema.safeParse(message);
    if (saveAnswer.success) {
      void (async () => {
        const now = new Date().toISOString();
        const { question, answer, fieldType, company, role } = saveAnswer.data.payload;
        await db.answerBank.add({
          id: crypto.randomUUID(),
          schemaVersion: 1,
          normalizedQuestion: normalizeQuestion(question),
          originalQuestion: question,
          answer,
          fieldType,
          company,
          role,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: null,
        });
        sendResponse({ ok: true });
      })();
      return true;
    }

    const answerBankRequest = getAnswerBankRequestSchema.safeParse(message);
    if (answerBankRequest.success) {
      void db.answerBank
        .toArray()
        .then((entries) =>
          entries.map((entry) => ({
            id: entry.id,
            originalQuestion: entry.originalQuestion,
            normalizedQuestion: entry.normalizedQuestion,
            answer: entry.answer,
            company: entry.company,
            role: entry.role,
          })),
        )
        .then(sendResponse);
      return true;
    }

    const cvFileRequest = getCvFileRequestSchema.safeParse(message);
    if (cvFileRequest.success) {
      void (async () => {
        const stored = await db.documents.get("cv");
        if (!stored) {
          sendResponse({ ok: false });
          return;
        }
        const dataBase64 = await blobToBase64(stored.blob);
        sendResponse({ ok: true, fileName: stored.fileName, mimeType: stored.mimeType, dataBase64 });
      })();
      return true;
    }

    const draftAnswers = draftAnswersRequestSchema.safeParse(message);
    if (draftAnswers.success) {
      void handleDraftAnswersRequest(draftAnswers.data.payload).then(sendResponse);
      return true;
    }

    const draftFieldAnswer = draftFieldAnswerRequestSchema.safeParse(message);
    if (draftFieldAnswer.success) {
      void (async () => {
        const { question, jobDescription, companyDomain, companyName, avoidTexts, knownFacts } = draftFieldAnswer.data.payload;
        const stored = await chromeLocalArea.get([LOCAL_KEYS.settings, LOCAL_KEYS.profile]);
        const settingsParsed = settingsSchema.safeParse(stored[LOCAL_KEYS.settings]);
        const profileParsed = profileSchema.safeParse(stored[LOCAL_KEYS.profile]);
        const settings = settingsParsed.success ? settingsParsed.data : createDefaultSettings();
        const profile = profileParsed.success ? profileParsed.data : createEmptyProfile();

        if (!settings.apiKey) {
          sendResponse({ ok: false, error: "No OpenAI API key is set." });
          return;
        }

        let companyBrief = "";
        if (companyDomain || companyName) {
          try {
            const brief = await getCompanyBrief({ domain: companyDomain, companyName, apiKey: settings.apiKey, model: settings.models.parse });
            companyBrief = brief.brief;
          } catch {
            // A missing company brief does not block an auto-drafted answer — the job description
            // (already required to get here) and the CV are enough to write something useful.
          }
        }

        try {
          const model = settings.betterQuality ? settings.models.answerBetter : settings.models.answer;
          const variants = await draftAnswerVariants({
            apiKey: settings.apiKey,
            model,
            question,
            cvSummary: profile.summary || profile.skills.join(", "),
            userNotes: knownFacts,
            jobDescription,
            companyBrief,
            avoidTexts,
          });
          sendResponse({ ok: true, variants });
        } catch (error) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not draft an answer for this field." });
        }
      })();
      return true;
    }

    const draftCoverLetterReq = draftCoverLetterRequestSchema.safeParse(message);
    if (draftCoverLetterReq.success) {
      void handleDraftCoverLetterRequest(draftCoverLetterReq.data.payload).then(sendResponse);
      return true;
    }

    const upsertApplication = upsertApplicationRequestSchema.safeParse(message);
    if (upsertApplication.success) {
      void (async () => {
        const { url, company, role, status } = upsertApplication.data.payload;
        const now = new Date().toISOString();
        const existing = await db.applications.filter((application) => application.url === url).first();
        if (existing) {
          await db.applications.update(existing.id, {
            company: company || existing.company,
            role: role || existing.role,
            status,
            date: now,
          });
        } else {
          await db.applications.add({
            id: crypto.randomUUID(),
            schemaVersion: 1,
            url,
            company,
            role,
            date: now,
            answerIds: [],
            status,
          });
        }
        sendResponse({ ok: true });
      })();
      return true;
    }

    const listApplications = listApplicationsRequestSchema.safeParse(message);
    if (listApplications.success) {
      void db.applications
        .toArray()
        .then((applications) => applications.sort((a, b) => b.date.localeCompare(a.date)))
        .then((applications) =>
          applications.map((application) => ({
            id: application.id,
            url: application.url,
            company: application.company,
            role: application.role,
            date: application.date,
            status: application.status,
          })),
        )
        .then(sendResponse);
      return true;
    }

    const updateApplicationStatus = updateApplicationStatusRequestSchema.safeParse(message);
    if (updateApplicationStatus.success) {
      void db.applications
        .update(updateApplicationStatus.data.payload.id, { status: updateApplicationStatus.data.payload.status })
        .then(() => sendResponse({ ok: true }));
      return true;
    }

    const deleteApplication = deleteApplicationRequestSchema.safeParse(message);
    if (deleteApplication.success) {
      void db.applications.delete(deleteApplication.data.payload.id).then(() => sendResponse({ ok: true }));
      return true;
    }

    const mapFields = mapFieldsRequestSchema.safeParse(message);
    if (mapFields.success) {
      void (async () => {
        // This is the Layer 2 fallback: only field id/label/kind/option labels were sent here,
        // never a value, so nothing personal reaches the model even for an unmatched field.
        const stored = await chromeLocalArea.get([LOCAL_KEYS.settings]);
        const settingsParsed = settingsSchema.safeParse(stored[LOCAL_KEYS.settings]);
        const settings = settingsParsed.success ? settingsParsed.data : createDefaultSettings();
        if (!settings.apiKey) {
          sendResponse({ ok: false, error: "No OpenAI API key is set." });
          return;
        }
        try {
          const mappings = await mapUnmatchedFields({
            apiKey: settings.apiKey,
            model: settings.models.parse,
            fields: mapFields.data.payload.fields,
            profileKeys: mapFields.data.payload.profileKeys,
          });
          sendResponse({ ok: true, mappings });
        } catch (error) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not map the remaining fields." });
        }
      })();
      return true;
    }
  });
});

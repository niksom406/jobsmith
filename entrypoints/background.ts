import { normalizeQuestion } from "../src/answerBank/matching";
import { mapUnmatchedFields } from "../src/llm/prompts/mapFields";
import { testOpenAiConnection } from "../src/llm/testConnection";
import { getAnswerBankRequestSchema, saveAnswerRequestSchema } from "../src/messaging/answerBankTypes";
import { draftAnswersRequestSchema } from "../src/messaging/draftTypes";
import { mapFieldsRequestSchema } from "../src/messaging/mapFieldsTypes";
import { testConnectionRequestSchema, testConnectionResultSchema } from "../src/messaging/types";
import { createDefaultSettings, settingsSchema } from "../src/schemas/settings";
import { chromeLocalArea, LOCAL_KEYS } from "../src/storage/localStore";
import { db } from "../src/storage/db";
import { handleDraftAnswersRequest } from "../src/llm/prompts/handleDraftAnswers";
import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older browsers without this call still open the panel from the toolbar menu.
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

    const draftAnswers = draftAnswersRequestSchema.safeParse(message);
    if (draftAnswers.success) {
      void handleDraftAnswersRequest(draftAnswers.data.payload).then(sendResponse);
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

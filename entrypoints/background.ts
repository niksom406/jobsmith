import { normalizeQuestion } from "../src/answerBank/matching";
import { testOpenAiConnection } from "../src/llm/testConnection";
import { getAnswerBankRequestSchema, saveAnswerRequestSchema } from "../src/messaging/answerBankTypes";
import { draftAnswersRequestSchema } from "../src/messaging/draftTypes";
import { testConnectionRequestSchema, testConnectionResultSchema } from "../src/messaging/types";
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
  });
});

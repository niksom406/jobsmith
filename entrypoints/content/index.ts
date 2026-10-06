import { adapterForHostname } from "../../src/autofill/adapters/registry";
import { detectFields } from "../../src/autofill/detect";
import { fillFields, undoFill, type UndoEntry } from "../../src/autofill/fill";
import { isCapturable, isLongTextField } from "../../src/autofill/formBounds";
import { matchFieldsHeuristically } from "../../src/autofill/heuristics";
import { detectSensitiveCategory } from "../../src/autofill/sensitiveFields";
import { flattenProfileValues } from "../../src/autofill/profileValues";
import { showSaveAnswerBanner } from "../../src/autofill/saveAnswerBanner";
import { saveAnswerRequestSchema } from "../../src/messaging/answerBankTypes";
import type { FieldSummary, FillStatus } from "../../src/messaging/fillTypes";
import { applySensitiveDefaults, removeSensitiveMatches } from "../../src/autofill/applySensitiveDefaults";
import { createEmptyPreferences, preferencesSchema } from "../../src/schemas/preferences";
import { createEmptyProfile, profileSchema } from "../../src/schemas/profile";
import { createEmptySensitiveDefaults, sensitiveDefaultsSchema } from "../../src/schemas/sensitiveDefaults";
import { findBestAnswerMatch } from "../../src/answerBank/matching";
import { attachFileToInput, setTextValue, isEmpty } from "../../src/autofill/setValue";
import { db } from "../../src/storage/db";
import { isAutomationBlocked } from "../../src/sites/access";
import { getAnswerBankRequestSchema, type AnswerBankEntrySummary } from "../../src/messaging/answerBankTypes";
import { chromeLocalArea, LOCAL_KEYS } from "../../src/storage/localStore";
import type { DetectedField } from "../../src/autofill/types";
import type { FillOutcome, UndoEntry as UndoEntryType } from "../../src/autofill/fill";
import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let lastUndo: UndoEntry[] = [];
    const promptedFields = new WeakSet<HTMLElement>();

    function labelForElement(element: HTMLElement): string {
      const id = element.getAttribute("id");
      if (id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (byFor?.textContent) return byFor.textContent.trim();
      }
      return element.closest("label")?.textContent?.trim() ?? element.getAttribute("aria-label") ?? element.getAttribute("name") ?? "";
    }

    function attachSavePrompt(element: HTMLInputElement | HTMLTextAreaElement) {
      if (promptedFields.has(element)) return;
      element.addEventListener("blur", () => {
        if (isAutomationBlocked(window.location.href)) return;
        if (!isCapturable(element) || !isLongTextField(element)) return;
        const value = element.value.trim();
        if (value.length < 8) return;
        if (promptedFields.has(element)) return;
        promptedFields.add(element);
        showSaveAnswerBanner(element, {
          question: labelForElement(element),
          answer: value,
          onSave: () => {
            void chrome.runtime.sendMessage(
              saveAnswerRequestSchema.parse({
                type: "save-answer",
                payload: {
                  question: labelForElement(element),
                  answer: value,
                  fieldType: element instanceof HTMLTextAreaElement ? "textarea" : "text",
                  company: "",
                  role: "",
                },
              }),
            );
          },
          onDismiss: () => {
            promptedFields.delete(element);
          },
        });
      });
    }

    function watchLongTextFields() {
      document
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input[type='text']")
        .forEach((element) => attachSavePrompt(element));
    }

    watchLongTextFields();
    new MutationObserver(() => watchLongTextFields()).observe(document.body, { childList: true, subtree: true });

    /** Attaches the stored CV to any empty file input, the user's own CV only — never auto-submitted. */
    async function attachStoredCvToFileInputs(fields: DetectedField[]) {
      const outcomes: FillOutcome[] = [];
      const fileFields = fields.filter((field) => field.kind === "file");
      if (fileFields.length === 0) return outcomes;
      const stored = await db.documents.get("cv");
      if (!stored) return outcomes;
      const file = new File([stored.blob], stored.fileName, { type: stored.mimeType });
      for (const field of fileFields) {
        const element = field.element as HTMLInputElement;
        if (element.files && element.files.length > 0) {
          outcomes.push({ fieldId: field.id, status: "skipped_not_empty" });
          continue;
        }
        await attachFileToInput(element, file);
        outcomes.push({ fieldId: field.id, status: "filled" });
      }
      return outcomes;
    }

    async function fetchAnswerBank(): Promise<AnswerBankEntrySummary[]> {
      try {
        const result = await chrome.runtime.sendMessage(getAnswerBankRequestSchema.parse({ type: "get-answer-bank" }));
        return Array.isArray(result) ? (result as AnswerBankEntrySummary[]) : [];
      } catch {
        return [];
      }
    }

    /** Fills long-text fields the heuristics could not match, from a strong answer-bank match. */
    function fillFromAnswerBank(
      unmatched: DetectedField[],
      bank: AnswerBankEntrySummary[],
    ): { outcomes: FillOutcome[]; undo: UndoEntryType[]; stillUnmatched: DetectedField[] } {
      const outcomes: FillOutcome[] = [];
      const undo: UndoEntryType[] = [];
      const stillUnmatched: DetectedField[] = [];

      for (const field of unmatched) {
        const isLongText = field.kind === "textarea" || field.kind === "text";
        if (!isLongText || !isEmpty(field.element)) {
          stillUnmatched.push(field);
          continue;
        }
        const match = findBestAnswerMatch(
          field.label,
          bank.map((entry) => ({ id: entry.id, originalQuestion: entry.originalQuestion, normalizedQuestion: entry.normalizedQuestion })),
        );
        const entry = match ? bank.find((candidate) => candidate.id === match.id) : null;
        if (!entry) {
          stillUnmatched.push(field);
          continue;
        }
        const element = field.element as HTMLInputElement | HTMLTextAreaElement;
        undo.push({ element, kind: "text", previousValue: element.value });
        setTextValue(element, entry.answer);
        outcomes.push({ fieldId: field.id, status: "filled" });
      }

      return { outcomes, undo, stillUnmatched };
    }

    async function loadProfileAndPreferences() {
      const stored = await chromeLocalArea.get([LOCAL_KEYS.profile, LOCAL_KEYS.preferences, LOCAL_KEYS.sensitiveDefaults]);
      const profile = profileSchema.safeParse(stored[LOCAL_KEYS.profile]);
      const preferences = preferencesSchema.safeParse(stored[LOCAL_KEYS.preferences]);
      const sensitiveDefaults = sensitiveDefaultsSchema.safeParse(stored[LOCAL_KEYS.sensitiveDefaults]);
      return {
        profile: profile.success ? profile.data : createEmptyProfile(),
        preferences: preferences.success ? preferences.data : createEmptyPreferences(),
        sensitiveDefaults: sensitiveDefaults.success ? sensitiveDefaults.data : createEmptySensitiveDefaults(),
      };
    }

    async function buildStatus(): Promise<FillStatus> {
      if (isAutomationBlocked(window.location.href)) {
        return { blocked: true, blockedReason: "Jobsmith does not run on this site.", totalFields: 0, fields: [] };
      }
      const fields = detectFields(document);
      const { profile, preferences, sensitiveDefaults } = await loadProfileAndPreferences();
      const sensitiveFieldIds = new Set(fields.filter((field) => Boolean(detectSensitiveCategory(field))).map((field) => field.id));
      const { matches, unmatched } = matchFieldsHeuristically(fields.filter((field) => !sensitiveFieldIds.has(field.id)));
      const values = flattenProfileValues(profile, preferences);
      const { outcomes } = fillFields(fields, matches, values);

      const byId = new Map(fields.map((field) => [field.id, field]));
      const summaries: FieldSummary[] = outcomes.map((outcome) => ({
        id: outcome.fieldId,
        label: byId.get(outcome.fieldId)?.label ?? "",
        kind: byId.get(outcome.fieldId)?.kind ?? "text",
        status: outcome.status,
      }));
      for (const field of unmatched) {
        summaries.push({ id: field.id, label: field.label, kind: field.kind, status: "unmatched" });
      }
      for (const fieldId of sensitiveFieldIds) {
        const field = byId.get(fieldId);
        if (field) summaries.push({ id: field.id, label: field.label, kind: field.kind, status: "skipped_sensitive" });
      }
      void sensitiveDefaults; // Detection-only pass does not write sensitive values; see "run-fill" below.

      // This pass was read-only (fillFields only mutates on the real "run-fill" call below).
      return { blocked: false, blockedReason: "", totalFields: fields.length, fields: summaries };
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "get-fill-status") {
        void buildStatus().then(sendResponse);
        return true;
      }
      if (message?.type === "run-fill") {
        void (async () => {
          if (isAutomationBlocked(window.location.href)) {
            sendResponse({ blocked: true, blockedReason: "Jobsmith does not run on this site.", totalFields: 0, fields: [] });
            return;
          }
          adapterForHostname(window.location.hostname);
          const fields = detectFields(document);
          const { profile, preferences, sensitiveDefaults } = await loadProfileAndPreferences();

          const sensitiveResult = applySensitiveDefaults(fields, sensitiveDefaults);
          const { matches, unmatched } = matchFieldsHeuristically(
            fields.filter((field) => !sensitiveResult.excludedFieldIds.has(field.id)),
          );
          const values = flattenProfileValues(profile, preferences);
          const safeMatches = removeSensitiveMatches(matches, sensitiveResult.excludedFieldIds);
          const { outcomes, undo } = fillFields(fields, safeMatches, values);

          const bank = await fetchAnswerBank();
          const fromBank = fillFromAnswerBank(unmatched, bank);

          const fileOutcomes = await attachStoredCvToFileInputs(fields);

          lastUndo = [...undo, ...fromBank.undo, ...sensitiveResult.undo];
          const allOutcomes = [...outcomes, ...fromBank.outcomes, ...sensitiveResult.outcomes, ...fileOutcomes];

          const byId = new Map(fields.map((field) => [field.id, field]));
          const summaries: FieldSummary[] = allOutcomes.map((outcome) => ({
            id: outcome.fieldId,
            label: byId.get(outcome.fieldId)?.label ?? "",
            kind: byId.get(outcome.fieldId)?.kind ?? "text",
            status: outcome.status,
          }));
          for (const field of fromBank.stillUnmatched) {
            summaries.push({ id: field.id, label: field.label, kind: field.kind, status: "unmatched" });
          }
          sendResponse({ blocked: false, blockedReason: "", totalFields: fields.length, fields: summaries });
        })();
        return true;
      }
      if (message?.type === "undo-fill") {
        undoFill(lastUndo);
        lastUndo = [];
        sendResponse({ ok: true });
        return true;
      }
      if (message?.type === "get-job-description") {
        import("../../src/jd/extractJobDescription").then(({ extractJobDescription }) => {
          sendResponse(extractJobDescription(document));
        });
        return true;
      }
      if (message?.type === "insert-answer") {
        const element = lastFocusedLongText;
        if (element) {
          setTextValue(element, message.payload.text as string);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false });
        }
        return true;
      }
    });

    let lastFocusedLongText: HTMLInputElement | HTMLTextAreaElement | null = null;
    document.addEventListener(
      "focusin",
      (event) => {
        const target = event.target;
        if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === "text")) {
          lastFocusedLongText = target;
        }
      },
      true,
    );
  },
});

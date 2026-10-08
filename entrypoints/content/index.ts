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
import { decryptSensitiveDefaultsForFill } from "../../src/autofill/decryptSensitiveDefaults";
import { createEmptyPreferences, preferencesSchema } from "../../src/schemas/preferences";
import { createEmptyProfile, profileSchema } from "../../src/schemas/profile";
import { createEmptySensitiveDefaults, sensitiveDefaultsSchema } from "../../src/schemas/sensitiveDefaults";
import { findBestAnswerMatch } from "../../src/answerBank/matching";
import { attachFileToInput, setTextValue, isEmpty } from "../../src/autofill/setValue";
import { getCvFileRequestSchema, getCvFileResultSchema } from "../../src/messaging/documentTypes";
import { base64ToBytes } from "../../src/storage/bytes";
import { isAutomationBlocked } from "../../src/sites/access";
import { getAnswerBankRequestSchema, type AnswerBankEntrySummary } from "../../src/messaging/answerBankTypes";
import { fieldsForMapping } from "../../src/llm/prompts/mapFields";
import { mapFieldsRequestSchema, mapFieldsResultSchema } from "../../src/messaging/mapFieldsTypes";
import { chromeLocalArea, LOCAL_KEYS } from "../../src/storage/localStore";
import { fillAriaComboboxes, fillWorkdayDateGroups, type WidgetOutcome } from "../../src/autofill/workdayWidgets";
import type { DetectedField, FieldMatch, ProfileValueMap } from "../../src/autofill/types";
import type { FillOutcome, UndoEntry as UndoEntryType } from "../../src/autofill/fill";
import { extractJobDescription } from "../../src/jd/extractJobDescription";
import {
  draftFieldAnswerRequestSchema,
  draftFieldAnswerResultSchema,
  replaceFieldAnswerRequestSchema,
  replaceFieldAnswerResultSchema,
} from "../../src/messaging/draftFieldTypes";
import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let lastUndo: UndoEntry[] = [];
    const promptedFields = new WeakSet<HTMLElement>();

    interface AiDraftEntry {
      element: HTMLInputElement | HTMLTextAreaElement;
      question: string;
      variants: { angle: string; text: string }[];
      usedIndex: number;
    }
    // Fresh on every "Fill" (see run-fill below) — tracks fields Jobsmith auto-drafted so the side
    // panel's "Replace" button can swap in another variant, or ask for a fresh one, without
    // re-detecting the whole page.
    let aiDraftState = new Map<string, AiDraftEntry>();

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

    const RESUME_FIELD_HINTS = /resume|\bcv\b|curriculum/i;
    const NON_RESUME_FILE_HINTS = /cover.?letter|transcript|portfolio|writing.?sample/i;

    /** True only for a file input that looks like a resume/CV upload — never a cover letter or
     * other attachment, since we only have one stored document and attaching it to the wrong
     * field would be worse than leaving it for the user to handle themselves. */
    function looksLikeResumeField(field: DetectedField): boolean {
      const element = field.element as HTMLInputElement;
      const text = `${field.label} ${element.id} ${element.name}`;
      if (NON_RESUME_FILE_HINTS.test(text)) return false;
      return RESUME_FIELD_HINTS.test(text);
    }

    /** Attaches the stored CV to the resume file input only, the user's own CV only — never auto-submitted. */
    async function attachStoredCvToFileInputs(fields: DetectedField[]) {
      const outcomes: FillOutcome[] = [];
      const fileFields = fields.filter((field) => field.kind === "file" && looksLikeResumeField(field));
      if (fileFields.length === 0) return outcomes;
      const response = await chrome.runtime.sendMessage(getCvFileRequestSchema.parse({ type: "get-cv-file" }));
      const parsedResponse = getCvFileResultSchema.safeParse(response);
      if (!parsedResponse.success || !parsedResponse.data.ok) return outcomes;
      const stored = parsedResponse.data;
      const file = new File([new Uint8Array(base64ToBytes(stored.dataBase64))], stored.fileName, { type: stored.mimeType });
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

    /**
     * Layer 2 fallback: asks the background to map still-unmatched fields to a profile key, sending
     * only each field's id/label/kind/option labels — never a value — then fills only the mappings the
     * model marked confident, through the same dropdown-matching/no-guess path as Layer 1.
     */
    async function fillFromLlmMapping(
      unmatched: DetectedField[],
      values: ProfileValueMap,
    ): Promise<{ outcomes: FillOutcome[]; undo: UndoEntryType[]; stillUnmatched: DetectedField[] }> {
      const eligible = unmatched.filter((field) => field.kind !== "textarea" && field.kind !== "file");
      if (eligible.length === 0) {
        return { outcomes: [], undo: [], stillUnmatched: unmatched };
      }
      let result: unknown;
      try {
        result = await chrome.runtime.sendMessage(
          mapFieldsRequestSchema.parse({
            type: "map-fields",
            payload: { fields: fieldsForMapping(eligible), profileKeys: Object.keys(values) },
          }),
        );
      } catch {
        return { outcomes: [], undo: [], stillUnmatched: unmatched };
      }
      const parsed = mapFieldsResultSchema.safeParse(result);
      if (!parsed.success || !parsed.data.ok) {
        return { outcomes: [], undo: [], stillUnmatched: unmatched };
      }

      const mappedFieldIds = new Set<string>();
      const matches: FieldMatch[] = [];
      for (const mapping of parsed.data.mappings) {
        if (!mapping.confident) continue;
        mappedFieldIds.add(mapping.fieldId);
        matches.push({ fieldId: mapping.fieldId, profileKey: mapping.profileKey, confidence: "fuzzy" });
      }

      const { outcomes, undo } = fillFields(eligible, matches, values);
      const stillUnmatched = unmatched.filter((field) => !mappedFieldIds.has(field.id) || !outcomes.some((outcome) => outcome.fieldId === field.id && outcome.status === "filled"));
      return { outcomes, undo, stillUnmatched };
    }

    /**
     * Last resort for long-text questions nothing else could match: drafts an answer from the CV,
     * notes, and this page's job description, the same way the "Draft an answer" panel does — but
     * automatically, for every remaining long-text field at once. Only runs if a job description
     * was actually found on the page; a question could not be answered well without one, so this is
     * the one case where Jobsmith stops rather than filling something in. Never invents facts: it's
     * the exact same draftAnswerVariants() call, same system prompt, same "use only the CV/notes"
     * rule as the manual panel.
     */
    async function fillFromAiDraft(
      unmatched: DetectedField[],
    ): Promise<{ outcomes: { fieldId: string; status: "filled_ai_draft" }[]; undo: UndoEntryType[]; stillUnmatched: DetectedField[] }> {
      const outcomes: { fieldId: string; status: "filled_ai_draft" }[] = [];
      const undo: UndoEntryType[] = [];
      const stillUnmatched: DetectedField[] = [];

      const longTextFields = unmatched.filter(
        (field) => field.kind === "textarea" || (field.kind === "text" && isLongTextField(field.element)),
      );
      for (const field of unmatched) {
        if (!longTextFields.includes(field)) stillUnmatched.push(field);
      }
      if (longTextFields.length === 0) return { outcomes, undo, stillUnmatched };

      const jd = extractJobDescription(document);
      if (jd.source === "none") {
        stillUnmatched.push(...longTextFields);
        return { outcomes, undo, stillUnmatched };
      }

      for (const field of longTextFields) {
        const element = field.element as HTMLInputElement | HTMLTextAreaElement;
        try {
          const response = await chrome.runtime.sendMessage(
            draftFieldAnswerRequestSchema.parse({
              type: "draft-field-answer",
              payload: { question: field.label, jobDescription: jd.text, companyDomain: window.location.hostname, avoidTexts: [] },
            }),
          );
          const parsed = draftFieldAnswerResultSchema.safeParse(response);
          const text = parsed.success && parsed.data.ok ? parsed.data.variants[0]?.text : undefined;
          if (!parsed.success || !parsed.data.ok || !text) {
            stillUnmatched.push(field);
            continue;
          }
          undo.push({ element, kind: "text", previousValue: element.value });
          setTextValue(element, text);
          outcomes.push({ fieldId: field.id, status: "filled_ai_draft" });
          aiDraftState.set(field.id, { element, question: field.label, variants: parsed.data.variants, usedIndex: 0 });
        } catch {
          stillUnmatched.push(field);
        }
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
          aiDraftState = new Map();
          const fields = detectFields(document);
          const { profile, preferences, sensitiveDefaults } = await loadProfileAndPreferences();
          const decryptedSensitiveDefaults = await decryptSensitiveDefaultsForFill(sensitiveDefaults);

          const sensitiveResult = applySensitiveDefaults(fields, decryptedSensitiveDefaults);
          const { matches, unmatched } = matchFieldsHeuristically(
            fields.filter((field) => !sensitiveResult.excludedFieldIds.has(field.id)),
          );
          const values = flattenProfileValues(profile, preferences);
          const safeMatches = removeSensitiveMatches(matches, sensitiveResult.excludedFieldIds);
          const { outcomes, undo } = fillFields(fields, safeMatches, values);

          const bank = await fetchAnswerBank();
          const fromBank = fillFromAnswerBank(unmatched, bank);
          const fromMapping = await fillFromLlmMapping(fromBank.stillUnmatched, values);

          const fileOutcomes = await attachStoredCvToFileInputs(fields);
          const fromAiDraft = await fillFromAiDraft(fromMapping.stillUnmatched);

          // Workday (and anything else using the same ARIA pattern) renders most pickers as custom
          // widgets rather than native <select>/<input type="date">, so they never show up in `fields`
          // at all; this runs as a separate pass over the live DOM instead of through fillFields.
          const widgetOutcomes: WidgetOutcome[] =
            adapterForHostname(window.location.hostname).id === "workday"
              ? [...(await fillAriaComboboxes(document, values)), ...fillWorkdayDateGroups(document, values)]
              : [];

          lastUndo = [...undo, ...fromBank.undo, ...fromMapping.undo, ...sensitiveResult.undo, ...fromAiDraft.undo];
          const allOutcomes = [...outcomes, ...fromBank.outcomes, ...fromMapping.outcomes, ...sensitiveResult.outcomes, ...fileOutcomes, ...fromAiDraft.outcomes];

          const byId = new Map(fields.map((field) => [field.id, field]));
          const summaries: FieldSummary[] = allOutcomes.map((outcome) => ({
            id: outcome.fieldId,
            label: byId.get(outcome.fieldId)?.label ?? "",
            kind: byId.get(outcome.fieldId)?.kind ?? "text",
            status: outcome.status,
          }));
          for (const field of fromAiDraft.stillUnmatched) {
            summaries.push({ id: field.id, label: field.label, kind: field.kind, status: "unmatched" });
          }
          widgetOutcomes.forEach((widget, index) => {
            summaries.push({
              id: `workday-widget-${index}`,
              label: widget.label,
              kind: "select",
              status: widget.status === "filled" || widget.status === "skipped_not_empty" || widget.status === "skipped_sensitive"
                ? widget.status
                : "unmatched",
            });
          });
          sendResponse({ blocked: false, blockedReason: "", totalFields: fields.length + widgetOutcomes.length, fields: summaries });
        })();
        return true;
      }
      if (message?.type === "undo-fill") {
        undoFill(lastUndo);
        lastUndo = [];
        sendResponse({ ok: true });
        return true;
      }
      if (message?.type === "replace-field-answer") {
        void (async () => {
          const parsedRequest = replaceFieldAnswerRequestSchema.safeParse(message);
          if (!parsedRequest.success) {
            sendResponse({ ok: false, error: "Invalid request." });
            return;
          }
          const fieldId = parsedRequest.data.payload.fieldId;
          const entry = aiDraftState.get(fieldId);
          if (!entry) {
            sendResponse({ ok: false, error: "This field was not auto-drafted by Jobsmith." });
            return;
          }

          // Cycle through variants already drafted (motivation/skills-fit/company-mission) before
          // spending another request on a brand-new set.
          const nextIndex = entry.usedIndex + 1;
          if (nextIndex < entry.variants.length) {
            const text = entry.variants[nextIndex]?.text ?? "";
            setTextValue(entry.element, text);
            aiDraftState.set(fieldId, { ...entry, usedIndex: nextIndex });
            sendResponse(replaceFieldAnswerResultSchema.parse({ ok: true }));
            return;
          }

          const jd = extractJobDescription(document);
          try {
            const response = await chrome.runtime.sendMessage(
              draftFieldAnswerRequestSchema.parse({
                type: "draft-field-answer",
                payload: {
                  question: entry.question,
                  jobDescription: jd.text,
                  companyDomain: window.location.hostname,
                  avoidTexts: entry.variants.map((variant) => variant.text),
                },
              }),
            );
            const parsed = draftFieldAnswerResultSchema.safeParse(response);
            const text = parsed.success && parsed.data.ok ? parsed.data.variants[0]?.text : undefined;
            if (!parsed.success || !parsed.data.ok || !text) {
              sendResponse(replaceFieldAnswerResultSchema.parse({ ok: false, error: "Could not draft a different answer." }));
              return;
            }
            setTextValue(entry.element, text);
            aiDraftState.set(fieldId, { ...entry, variants: [...entry.variants, ...parsed.data.variants], usedIndex: entry.variants.length });
            sendResponse(replaceFieldAnswerResultSchema.parse({ ok: true }));
          } catch {
            sendResponse(replaceFieldAnswerResultSchema.parse({ ok: false, error: "Could not reach the extension background." }));
          }
        })();
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

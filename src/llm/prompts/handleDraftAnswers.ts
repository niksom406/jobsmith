import { findBestAnswerMatch } from "../../answerBank/matching";
import { getCompanyBrief } from "../../company/companyBrief";
import { buildKnownFactsNote } from "../../autofill/knownFacts";
import { profileSchema, createEmptyProfile } from "../../schemas/profile";
import { preferencesSchema, createEmptyPreferences } from "../../schemas/preferences";
import { settingsSchema, createDefaultSettings } from "../../schemas/settings";
import { db } from "../../storage/db";
import { chromeLocalArea, LOCAL_KEYS } from "../../storage/localStore";
import type { DraftAnswersRequest, DraftAnswersResult } from "../../messaging/draftTypes";
import { draftAnswerVariants, verifyAnswerClaims } from "./draftAnswer";

export async function handleDraftAnswersRequest(payload: DraftAnswersRequest["payload"]): Promise<DraftAnswersResult> {
  const stored = await chromeLocalArea.get([LOCAL_KEYS.settings, LOCAL_KEYS.profile, LOCAL_KEYS.preferences]);
  const settingsParsed = settingsSchema.safeParse(stored[LOCAL_KEYS.settings]);
  const profileParsed = profileSchema.safeParse(stored[LOCAL_KEYS.profile]);
  const preferencesParsed = preferencesSchema.safeParse(stored[LOCAL_KEYS.preferences]);
  const settings = settingsParsed.success ? settingsParsed.data : createDefaultSettings();
  const profile = profileParsed.success ? profileParsed.data : createEmptyProfile();
  const preferences = preferencesParsed.success ? preferencesParsed.data : createEmptyPreferences();
  // The user's own typed notes take priority (they're more specific); the saved logistics facts
  // from Preferences are appended after, so a question about availability/salary/relocation can be
  // answered from what's actually saved instead of declining for lack of information.
  const userNotes = [payload.userNotes, buildKnownFactsNote(preferences)].filter(Boolean).join("\n\n");

  if (!settings.apiKey) {
    return { ok: false, error: "Add an OpenAI API key in Settings → AI before drafting an answer.", needsCompanyBrief: false, needsJobDescription: false };
  }

  // Step 1: a strong answer-bank match is reused as-is rather than redrafted from scratch.
  const bankEntries = await db.answerBank.toArray();
  const bankMatch = findBestAnswerMatch(
    payload.question,
    bankEntries.map((entry) => ({ id: entry.id, originalQuestion: entry.originalQuestion, normalizedQuestion: entry.normalizedQuestion })),
    0.75,
  );
  if (bankMatch) {
    const entry = bankEntries.find((candidate) => candidate.id === bankMatch.id);
    if (entry) {
      return {
        ok: true,
        variants: [{ angle: "motivation", text: entry.answer }],
        unsupportedClaims: [],
        companyBriefSource: "none",
        usedAnswerBank: true,
      };
    }
  }

  if (!payload.jobDescription.trim()) {
    return { ok: false, error: "Jobsmith could not read the job description.", needsCompanyBrief: false, needsJobDescription: true };
  }

  const model = settings.betterQuality ? settings.models.answerBetter : settings.models.answer;

  let companyBriefSource: "cache" | "web_search" | "about_page" | "user" | "none" = "none";
  let companyBrief = "";
  if (payload.companyDomain || payload.companyName) {
    const brief = await getCompanyBrief({
      domain: payload.companyDomain,
      companyName: payload.companyName,
      apiKey: settings.apiKey,
      model: settings.models.parse,
    });
    companyBrief = brief.brief;
    companyBriefSource = brief.source;
  }
  if (!companyBrief && !userNotes.trim()) {
    return {
      ok: false,
      error: "Jobsmith searched the web but could not find a reliable company brief for this domain.",
      needsCompanyBrief: true,
      needsJobDescription: false,
    };
  }

  const variants = await draftAnswerVariants({
    apiKey: settings.apiKey,
    model,
    question: payload.question,
    cvSummary: profile.summary || profile.skills.join(", "),
    userNotes,
    jobDescription: payload.jobDescription,
    companyBrief,
    characterLimit: payload.characterLimit ?? undefined,
  });

  const unsupportedClaims = await verifyAnswerClaims({
    apiKey: settings.apiKey,
    model: settings.models.parse,
    draft: variants[0]?.text ?? "",
    cvSummary: profile.summary,
    userNotes,
  });

  return { ok: true, variants, unsupportedClaims, companyBriefSource, usedAnswerBank: false };
}

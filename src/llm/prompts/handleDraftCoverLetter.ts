import { getCompanyBrief } from "../../company/companyBrief";
import { buildKnownFactsNote } from "../../autofill/knownFacts";
import { buildCvDraftContext } from "../../autofill/cvDraftContext";
import { profileSchema, createEmptyProfile } from "../../schemas/profile";
import { preferencesSchema, createEmptyPreferences } from "../../schemas/preferences";
import { settingsSchema, createDefaultSettings } from "../../schemas/settings";
import { chromeLocalArea, LOCAL_KEYS } from "../../storage/localStore";
import type { DraftCoverLetterRequest, DraftCoverLetterResult } from "../../messaging/coverLetterTypes";
import { draftCoverLetter } from "./draftCoverLetter";
import { verifyAnswerClaims } from "./draftAnswer";

export async function handleDraftCoverLetterRequest(payload: DraftCoverLetterRequest["payload"]): Promise<DraftCoverLetterResult> {
  const stored = await chromeLocalArea.get([LOCAL_KEYS.settings, LOCAL_KEYS.profile, LOCAL_KEYS.preferences]);
  const settingsParsed = settingsSchema.safeParse(stored[LOCAL_KEYS.settings]);
  const profileParsed = profileSchema.safeParse(stored[LOCAL_KEYS.profile]);
  const preferencesParsed = preferencesSchema.safeParse(stored[LOCAL_KEYS.preferences]);
  const settings = settingsParsed.success ? settingsParsed.data : createDefaultSettings();
  const profile = profileParsed.success ? profileParsed.data : createEmptyProfile();
  const preferences = preferencesParsed.success ? preferencesParsed.data : createEmptyPreferences();
  const userNotes = [payload.userNotes, buildKnownFactsNote(preferences)].filter(Boolean).join("\n\n");

  if (!settings.apiKey) {
    return { ok: false, error: "Add an OpenAI API key in Settings → AI before drafting a cover letter.", needsJobDescription: false };
  }
  if (!payload.jobDescription.trim()) {
    return { ok: false, error: "Jobsmith could not read the job description from this page. Paste it in first.", needsJobDescription: true };
  }

  const model = settings.betterQuality ? settings.models.answerBetter : settings.models.answer;

  let companyBrief = "";
  if (payload.companyDomain || payload.companyName) {
    try {
      const brief = await getCompanyBrief({
        domain: payload.companyDomain,
        companyName: payload.companyName,
        apiKey: settings.apiKey,
        model: settings.models.parse,
      });
      companyBrief = brief.brief;
    } catch {
      // A missing company brief does not block a cover letter -- the job description and CV are
      // enough to write something useful; it will simply reference the company less specifically.
    }
  }

  const text = await draftCoverLetter({
    apiKey: settings.apiKey,
    model,
    jobTitle: payload.jobTitle,
    companyName: payload.companyName,
    cvSummary: buildCvDraftContext(profile) || profile.summary || profile.skills.join(", "),
    userNotes,
    jobDescription: payload.jobDescription,
    companyBrief,
    wordLimit: payload.wordLimit ?? undefined,
  });

  const unsupportedClaims = await verifyAnswerClaims({
    apiKey: settings.apiKey,
    model: settings.models.parse,
    draft: text,
    cvSummary: buildCvDraftContext(profile) || profile.summary,
    userNotes,
  });

  return { ok: true, text, unsupportedClaims };
}

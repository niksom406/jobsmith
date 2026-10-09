import type { Profile } from "../schemas/profile";

/**
 * A richer CV snapshot for answer drafting than `profile.summary` alone. Personal questions
 * ("fun fact", hobbies) and experience questions both need work highlights, languages, and
 * education — not just the one-paragraph summary — or the model correctly refuses for lack of
 * material even when the CV has plenty.
 */
export function buildCvDraftContext(profile: Profile): string {
  const parts: string[] = [];
  if (profile.summary.trim()) parts.push(profile.summary.trim());
  if (profile.skills.length) parts.push(`Skills: ${profile.skills.join(", ")}`);
  for (const job of profile.workHistory) {
    const bits = [job.title, job.company, job.location, ...job.highlights].filter((bit) => bit.trim());
    if (bits.length) parts.push(`Work: ${bits.join(" — ")}`);
  }
  for (const item of profile.education) {
    const bits = [item.degree, item.field, item.school].filter((bit) => bit.trim());
    if (bits.length) parts.push(`Education: ${bits.join(", ")}`);
  }
  for (const item of profile.certifications) {
    const bits = [item.name, item.issuer].filter((bit) => bit.trim());
    if (bits.length) parts.push(`Certification: ${bits.join(", ")}`);
  }
  for (const item of profile.languages) {
    const bits = [item.name, item.proficiency].filter((bit) => bit.trim());
    if (bits.length) parts.push(`Language: ${bits.join(" — ")}`);
  }
  return parts.join("\n");
}

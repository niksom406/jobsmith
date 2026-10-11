import { z } from "zod";
import { callLlmJson } from "../client";

/**
 * The shape of a single field sent to the agent.
 * For radio/select: options is the list of labels the user can choose from.
 * For text/combobox: options is empty and the agent returns a free-text answer.
 */
export interface AgentFieldInput {
  id: string;
  label: string;
  kind: "radio" | "select" | "text" | "combobox";
  options: string[];
}

const agentFillSchema = z.strictObject({
  answers: z.array(
    z.strictObject({
      fieldId: z.string(),
      /** For radio/select: the exact option label to pick. For text/combobox: the value to type. */
      value: z.string(),
      /** False when the model is not confident enough to fill the field automatically. */
      confident: z.boolean(),
      /** One-line reason shown in the side-panel (e.g. "Inferred from relocation=yes preference"). */
      reason: z.string(),
    }),
  ),
});

export type AgentFillSchema = z.infer<typeof agentFillSchema>;

const SYSTEM_PROMPT = `You are filling job application form fields on behalf of a candidate, using only the
profile and preferences facts provided. For each field:

- If it is a radio or select field, return the EXACT option label from the provided options list that best
  matches what the candidate should answer given their profile. Set confident=false if you cannot determine
  a sensible answer, or if the question asks about something not covered by the candidate's profile.
- If it is a text or combobox field, return the best value to type from the candidate's profile
  (e.g. for a location combobox, return their city). Set confident=false if no relevant data is in the profile.
- For yes/no style questions (radio with "Yes"/"No" options), reason carefully:
  - "Do you have the right to work in X?" → check the rightToWork list
  - "Do you require visa sponsorship?" → check sponsorshipNeeded
  - "Are you willing to relocate?" → check relocation preference
  - "Are you able to work from our [city] office N days a week?" → if the candidate's city matches or they
    are willing to relocate, answer "Yes" only if clearly supported by profile. Otherwise set confident=false.
  - "Have you been employed by [Company] before?" → Check the candidate's work history. If [Company] is NOT in their work history, answer "No" confidently.
  - "Country of Residence" / Location dropdowns → Extract the exact country from the candidate's location (e.g. "London, UK" -> "United Kingdom").
  - Sensitive questions (e.g. Race/Ethnicity, Gender) → Since you are answering on their behalf based on their provided data, answer them if the information is clearly present in their profile. If missing, set confident=false.
  - When in doubt, set confident=false — never guess on yes/no questions with real consequences.
- NEVER invent facts not present in the profile. Only use what you are explicitly given.
- Return answers only for fields you are confident about. For uncertain fields, still return an entry but
  with confident=false and a brief reason why.`;

export interface AgentFillInput {
  apiKey: string;
  model: string;
  fields: AgentFieldInput[];
  /** The full profile context as a plain-text summary. */
  profileSummary: string;
  fetchImpl?: typeof fetch;
}

export async function agentFillFields(
  input: AgentFillInput,
): Promise<AgentFillSchema["answers"]> {
  if (input.fields.length === 0) return [];

  const result = await callLlmJson({
    apiKey: input.apiKey,
    model: input.model,
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      candidateProfile: input.profileSummary,
      fields: input.fields,
    }),
    schema: agentFillSchema,
    schemaName: "agent_fill",
    maxOutputTokens: 800,
    fetchImpl: input.fetchImpl,
  });

  return result.data.answers;
}

/**
 * Builds a plain-text summary of the candidate's full profile + preferences for the agent prompt.
 * This is intentionally comprehensive — the agent needs all facts to reason about edge cases like
 * "Are you able to work from our New York or London office 5 days a week?"
 */
export function buildAgentProfileSummary(options: {
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  currentTitle: string;
  currentCompany: string;
  sponsorshipNeeded: boolean | null;
  relocation: "yes" | "no" | "discuss";
  remotePreference: "remote" | "hybrid" | "onsite" | "flexible";
  noticePeriod: string;
  salaryAmount: string;
  salaryCurrency: string;
  rightToWork: { country: string; status: string }[];
  willingnessToTravel: "none" | "occasional" | "frequent";
  skills: string[];
}): string {
  const lines: string[] = [];

  if (options.name) lines.push(`Name: ${options.name}`);
  if (options.email) lines.push(`Email: ${options.email}`);
  if (options.phone) lines.push(`Phone: ${options.phone}`);

  const addressParts = [
    options.address.line1,
    options.address.line2,
    options.address.city,
    options.address.region,
    options.address.postalCode,
    options.address.country,
  ].filter(Boolean);
  if (addressParts.length > 0) lines.push(`Address: ${addressParts.join(", ")}`);
  if (options.address.city) lines.push(`City: ${options.address.city}`);
  if (options.address.country) lines.push(`Country: ${options.address.country}`);

  if (options.currentTitle) lines.push(`Current job title: ${options.currentTitle}`);
  if (options.currentCompany) lines.push(`Current employer: ${options.currentCompany}`);

  lines.push(
    `Requires visa sponsorship: ${
      options.sponsorshipNeeded === null ? "unknown" : options.sponsorshipNeeded ? "Yes" : "No"
    }`,
  );

  const relocationLabel = {
    yes: "Yes, willing to relocate",
    no: "No, not willing to relocate",
    discuss: "Open to discussing relocation",
  }[options.relocation];
  lines.push(`Relocation: ${relocationLabel}`);

  const remoteLabel = {
    remote: "Prefers fully remote",
    hybrid: "Prefers hybrid",
    onsite: "Prefers on-site",
    flexible: "Flexible / no strong preference",
  }[options.remotePreference];
  lines.push(`Work location preference: ${remoteLabel}`);

  const travelLabel = {
    none: "Not willing to travel for work",
    occasional: "Willing to travel occasionally",
    frequent: "Willing to travel frequently",
  }[options.willingnessToTravel];
  lines.push(`Travel for work: ${travelLabel}`);

  if (options.noticePeriod) lines.push(`Notice period: ${options.noticePeriod}`);
  if (options.salaryAmount) lines.push(`Salary expectation: ${options.salaryAmount} ${options.salaryCurrency}`);

  if (options.rightToWork.length > 0) {
    lines.push(
      `Right to work: ${options.rightToWork.map((entry) => `${entry.country} (${entry.status})`).join(", ")}`,
    );
  }

  if (options.skills.length > 0) lines.push(`Skills: ${options.skills.slice(0, 15).join(", ")}`);

  return lines.join("\n");
}

import { z } from "zod";

export const PROFILE_VERSION = 1;

export const workHistoryItemSchema = z.strictObject({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  current: z.boolean(),
  highlights: z.array(z.string()),
});

export const educationItemSchema = z.strictObject({
  school: z.string(),
  degree: z.string(),
  field: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export const certificationItemSchema = z.strictObject({
  name: z.string(),
  issuer: z.string(),
  date: z.string(),
});

export const languageItemSchema = z.strictObject({
  name: z.string(),
  proficiency: z.string(),
});

export const profileSchema = z.strictObject({
  schemaVersion: z.literal(PROFILE_VERSION),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.strictObject({
    line1: z.string(),
    line2: z.string(),
    city: z.string(),
    region: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),
  links: z.strictObject({
    linkedin: z.string(),
    github: z.string(),
    portfolio: z.string(),
  }),
  summary: z.string(),
  skills: z.array(z.string()),
  workHistory: z.array(workHistoryItemSchema),
  education: z.array(educationItemSchema),
  certifications: z.array(certificationItemSchema),
  languages: z.array(languageItemSchema),
});

export type Profile = z.infer<typeof profileSchema>;
export type WorkHistoryItem = z.infer<typeof workHistoryItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type CertificationItem = z.infer<typeof certificationItemSchema>;
export type LanguageItem = z.infer<typeof languageItemSchema>;

export function createEmptyProfile(): Profile {
  return {
    schemaVersion: PROFILE_VERSION,
    name: "",
    email: "",
    phone: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "",
    },
    links: { linkedin: "", github: "", portfolio: "" },
    summary: "",
    skills: [],
    workHistory: [],
    education: [],
    certifications: [],
    languages: [],
  };
}

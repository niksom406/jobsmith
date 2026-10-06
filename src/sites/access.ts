/** Hosts where Jobsmith must never run, even if a permission was granted. */
const BLOCKED_HOST_SUFFIXES = ["linkedin.com", "lnkd.in"];

export function isAutomationBlocked(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  return BLOCKED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

export interface KnownAts {
  id: string;
  label: string;
  detail: string;
  origins: string[];
}

export const KNOWN_ATS: KnownAts[] = [
  {
    id: "greenhouse",
    label: "Greenhouse",
    detail: "Company boards hosted on greenhouse.io",
    origins: ["https://*.greenhouse.io/*"],
  },
  {
    id: "lever",
    label: "Lever",
    detail: "Postings hosted on lever.co",
    origins: ["https://*.lever.co/*"],
  },
  {
    id: "ashby",
    label: "Ashby",
    detail: "Postings hosted on ashbyhq.com",
    origins: ["https://*.ashbyhq.com/*"],
  },
  {
    id: "smartrecruiters",
    label: "SmartRecruiters",
    detail: "Postings hosted on smartrecruiters.com",
    origins: ["https://*.smartrecruiters.com/*"],
  },
  {
    id: "workday",
    label: "Workday",
    detail: "Hosts on myworkdayjobs.com. Deeper company.wd1 addresses need Enable on this site.",
    origins: ["https://*.myworkdayjobs.com/*"],
  },
];

/** Chrome match pattern for one site, or null when the URL must not be enabled. */
export function originPatternFromUrl(url: string): string | null {
  if (isAutomationBlocked(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

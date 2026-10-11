import { useState } from "react";
import type { ExtractedJd } from "../../src/jd/extractJobDescription";
import { draftCoverLetterRequestSchema, type DraftCoverLetterResult } from "../../src/messaging/coverLetterTypes";
import { useActiveTabMessage } from "../../src/ui/useActiveTabMessaging";

export function CoverLetterPanel() {
  const sendToTab = useActiveTabMessage();
  const [jd, setJd] = useState<ExtractedJd | null>(null);
  const [jdPaste, setJdPaste] = useState("");
  const [domain, setDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [wordLimit, setWordLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DraftCoverLetterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadJd() {
    const found = await sendToTab<ExtractedJd>({ type: "get-job-description" });
    setJd(found);
    setCompanyName(found?.companyName ?? "");
    const titleResult = await sendToTab<{ title: string | null }>({ type: "get-job-title" });
    if (titleResult?.title) setJobTitle(titleResult.title);
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        try {
          setDomain(new URL(tab.url).hostname);
        } catch {
          // Leave domain blank; the brief still works from a company name alone.
        }
      }
    }
  }

  async function draft() {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    const jobDescription = jd?.text || jdPaste;
    try {
      const message = draftCoverLetterRequestSchema.parse({
        type: "draft-cover-letter",
        payload: {
          jobTitle,
          companyName,
          companyDomain: domain,
          jobDescription,
          userNotes: notes,
          wordLimit: wordLimit.trim() ? Number(wordLimit) : null,
        },
      });
      const response = (await chrome.runtime.sendMessage(message)) as DraftCoverLetterResult;
      setResult(response);
    } catch {
      setError("Could not reach the extension background.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Could not copy to the clipboard. Select the text above and copy it manually.");
    }
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h2 className="font-serif text-lg">Draft a cover letter</h2>
      <p className="text-sm text-muted">
        Written only from your CV, the job description on this page, and the notes you add below — never invented.
      </p>
      <button type="button" onClick={() => void loadJd()} className="rounded-md bg-[#C9A84C] text-[#1a1500] hover:bg-[#e8c96a] px-3 py-2 text-sm font-medium border border-[#C9A84C] shadow-sm">
        Read job description from this page
      </button>
      {jd?.source === "none" ? (
        <textarea
          value={jdPaste}
          onChange={(event) => setJdPaste(event.target.value)}
          placeholder="Could not read the job description automatically. Paste it here."
          className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
          rows={3}
        />
      ) : null}
      {jd && jd.source !== "none" ? <p className="text-sm text-muted">Job description read from this page ({jd.source}).</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="cover-letter-job-title">
            Job title (correct it if this is wrong)
          </label>
          <input
            id="cover-letter-job-title"
            type="text"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="e.g. Senior Software Engineer"
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="cover-letter-company-name">
            Company name
          </label>
          <input
            id="cover-letter-company-name"
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="e.g. Acme Robotics"
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional: anything specific you want mentioned (a project, a reason you want this role, etc.)"
        className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
        rows={2}
      />
      <div>
        <label className="mb-1 block text-xs text-muted" htmlFor="cover-letter-word-limit">
          Word limit (optional)
        </label>
        <input
          id="cover-letter-word-limit"
          type="number"
          min={50}
          value={wordLimit}
          onChange={(event) => setWordLimit(event.target.value)}
          placeholder="e.g. 350"
          className="w-32 rounded-md border border-line bg-card px-3 py-2 text-sm"
        />
      </div>
      <button type="button" disabled={busy} onClick={() => void draft()} className="rounded-md bg-moss px-3 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Drafting…" : "Draft cover letter"}
      </button>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {result && !result.ok ? (
        <p className="text-sm text-clay">
          {result.error}
          {result.needsJobDescription ? " Paste the job description above." : ""}
        </p>
      ) : null}
      {result?.ok ? (
        <div className="space-y-2 rounded-md border border-line bg-card p-3">
          {result.unsupportedClaims.length > 0 ? (
            <div className="rounded-md border border-clay bg-card px-3 py-2 text-sm text-clay">
              <p className="font-medium">Check before using:</p>
              <ul className="list-disc pl-4">
                {result.unsupportedClaims.map((claim) => (
                  <li key={claim}>{claim}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-sm whitespace-pre-wrap">{result.text}</p>
          <button type="button" onClick={() => void copyToClipboard(result.text)} className="rounded-md border border-line px-3 py-1 text-sm">
            {copied ? "Copied" : "Copy to clipboard"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

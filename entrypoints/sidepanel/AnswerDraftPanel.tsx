import { useState } from "react";
import type { ExtractedJd } from "../../src/jd/extractJobDescription";
import { draftAnswersRequestSchema, type DraftAnswersResult } from "../../src/messaging/draftTypes";
import { useActiveTabMessage } from "../../src/ui/useActiveTabMessaging";

export function AnswerDraftPanel() {
  const sendToTab = useActiveTabMessage();
  const [question, setQuestion] = useState("");
  const [jd, setJd] = useState<ExtractedJd | null>(null);
  const [jdPaste, setJdPaste] = useState("");
  const [domain, setDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DraftAnswersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadJd() {
    const found = await sendToTab<ExtractedJd>({ type: "get-job-description" });
    setJd(found);
    setCompanyName(found?.companyName ?? "");
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        try {
          setDomain(new URL(tab.url).hostname);
        } catch {
          // Leave domain blank; the user can type a company brief into notes instead.
        }
      }
    }
  }

  async function draft() {
    if (!question.trim()) {
      setError("Type or paste the question first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const jobDescription = jd?.text || jdPaste;
    try {
      const message = draftAnswersRequestSchema.parse({
        type: "draft-answers",
        payload: { question, jobDescription, companyDomain: domain, companyName, userNotes: notes, characterLimit: null },
      });
      const response = (await chrome.runtime.sendMessage(message)) as DraftAnswersResult;
      setResult(response);
    } catch {
      setError("Could not reach the extension background.");
    } finally {
      setBusy(false);
    }
  }

  async function insert(text: string) {
    await sendToTab({ type: "insert-answer", payload: { text } });
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h2 className="font-serif text-lg">Draft an answer</h2>
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Paste the question, e.g. “Why do you want to work here?”"
        className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void loadJd()} className="rounded-md bg-[#C9A84C] text-[#1a1500] hover:bg-[#e8c96a] px-3 py-2 text-sm font-medium border border-[#C9A84C] shadow-sm">
          Read job description from this page
        </button>
      </div>
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
      {jd ? (
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="draft-company-name">
            Company name (used for the brief — correct it if this is wrong)
          </label>
          <input
            id="draft-company-name"
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="e.g. Acme Robotics"
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
      ) : null}
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional: a rough answer or a few notes only you know (used instead of inventing facts)"
        className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
        rows={2}
      />
      <button type="button" disabled={busy} onClick={() => void draft()} className="rounded-md bg-moss px-3 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Drafting…" : "Draft answer"}
      </button>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {result && !result.ok ? (
        <p className="text-sm text-clay">
          {result.error}
          {result.needsCompanyBrief ? " Add a note above with a line or two about the company." : ""}
          {result.needsJobDescription ? " Paste the job description above." : ""}
        </p>
      ) : null}
      {result?.ok ? (
        <div className="space-y-3">
          {result.usedAnswerBank ? <p className="text-sm text-muted">Reused a saved answer to a similar question.</p> : null}
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
          {result.variants.map((variant) => (
            <div key={variant.angle} className="space-y-2 rounded-md border border-line bg-card p-3">
              <p className="text-xs tracking-wide text-muted uppercase">{variant.angle.replace("_", " ")}</p>
              <p className="text-sm whitespace-pre-wrap">{variant.text}</p>
              <button type="button" onClick={() => void insert(variant.text)} className="rounded-md border border-line px-3 py-1 text-sm">
                Insert into focused field
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

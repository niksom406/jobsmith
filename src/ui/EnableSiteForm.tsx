import { useState } from "react";
import { isAutomationBlocked, originPatternFromUrl } from "../sites/access";

export function EnableSiteForm() {
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "bad">("ok");

  async function readOpenTab() {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      setTone("bad");
      setMessage("Paste the page address. This view cannot see the open tab.");
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      setTone("bad");
      setMessage("Chrome did not share the tab address. Paste it above.");
      return;
    }
    setAddress(tab.url);
    setMessage(null);
  }

  async function enable() {
    const pattern = originPatternFromUrl(address.trim());
    if (!pattern) {
      setTone("bad");
      setMessage(
        isAutomationBlocked(address.trim())
          ? "Jobsmith does not run on LinkedIn."
          : "Enter a full page address, including https://.",
      );
      return;
    }
    if (typeof chrome === "undefined" || !chrome.permissions) {
      setTone("bad");
      setMessage("Site access can only be granted from the installed extension.");
      return;
    }
    const granted = await chrome.permissions.request({ origins: [pattern] });
    setTone(granted ? "ok" : "bad");
    setMessage(granted ? `Jobsmith can read ${pattern}` : "Permission was not granted.");
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-muted" htmlFor="site-address">
        Page address
      </label>
      <input
        id="site-address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="https://careers.example.com/jobs/123"
        className="w-full rounded-md border border-line bg-card px-3 py-2 outline-none ring-moss focus:ring-2"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void readOpenTab()} className="rounded-md border border-line bg-card px-3 py-2 text-sm">
          Use the open tab
        </button>
        <button type="button" onClick={() => void enable()} className="rounded-md bg-moss px-3 py-2 text-sm text-white">
          Enable Jobsmith on this site
        </button>
      </div>
      {message ? <p className={tone === "ok" ? "text-sm text-moss-dark" : "text-sm text-clay"}>{message}</p> : null}
    </div>
  );
}

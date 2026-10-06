import { useCallback } from "react";

/** Sends a message to the content script in the active tab, if any. */
export function useActiveTabMessage() {
  return useCallback(async <T,>(message: unknown): Promise<T | null> => {
    if (typeof chrome === "undefined" || !chrome.tabs) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    try {
      return (await chrome.tabs.sendMessage(tab.id, message)) as T;
    } catch {
      return null;
    }
  }, []);
}

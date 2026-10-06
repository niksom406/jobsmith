import { testOpenAiConnection } from "../src/llm/testConnection";
import { testConnectionRequestSchema, testConnectionResultSchema } from "../src/messaging/types";
import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older browsers without this call still open the panel from the toolbar menu.
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const parsed = testConnectionRequestSchema.safeParse(message);
    if (!parsed.success) return;

    void testOpenAiConnection(parsed.data.payload.apiKey, parsed.data.payload.model).then((result) => {
      sendResponse(testConnectionResultSchema.parse(result));
    });
    return true;
  });
});

// entrypoints/background.ts
import { defineBackground } from '#imports';

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Optional: Listen for tab changes to update panel if needed
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    // You can set tab-specific options here if you ever want per-site panels
    // For now, global is fine
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      // Optional: If high-risk later, can try chrome.sidePanel.open({tabId})
      // But avoid auto-open spam
    }
  });
});
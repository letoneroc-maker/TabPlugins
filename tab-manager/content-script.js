/**
 * Tab Manager - Content Script
 * Injected into each tab to capture screenshot from that tab's context.
 */

(function () {
  // Listen for screenshot requests from the background service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'captureScreenshot') {
      const targetTabId = request.tabId;
      const quality = request.quality || 'medium';

      // Quality settings for the capture
      const jpegQuality = quality === 'high' ? 80 : quality === 'medium' ? 70 : 60;

      chrome.tabs.captureTab(
        targetTabId,
        { format: 'jpeg', quality: jpegQuality },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message, tabId: targetTabId });
          } else {
            sendResponse({ success: true, dataUrl, tabId: targetTabId });
          }
        }
      );
      return true; // async response
    }
  });

  // Let background know this content script is loaded
  chrome.runtime.sendMessage({ type: 'contentScriptReady', url: window.location.href });
})();

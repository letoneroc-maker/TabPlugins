/**
 * Tab Manager - Background Service Worker
 * Handles: tab listing, screenshot orchestration, caching
 * 
 * Architecture:
 * - Content scripts pre-injected via manifest on all http/https pages
 * - background.js routes screenshot requests → target tab's content script
 * - content script captures screenshot → sends dataUrl back
 * - background.js caches result, forwards to app.js
 */

// In-memory screenshot cache: tabId → dataUrl
const screenshotCache = new Map();

// Active capture promises (to avoid duplicate requests)
const activeCaptures = new Map();

const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

// ============================================================
// Message Handlers
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, tabId, quality } = request;

  if (type === 'ping') {
    sendResponse({ pong: true, ts: Date.now() });
    return true;
  }

  if (type === 'getTabs') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message, tabs: [] });
        return;
      }
      const filtered = tabs.filter(tab => {
        const url = tab.url || '';
        return !url.startsWith('chrome://newtab') &&
               !url.startsWith('chrome://start/') &&
               !url.startsWith('about:') &&
               !url.startsWith('chrome-extension://');
      });
      filtered.sort((a, b) => (a.index || 0) - (b.index || 0));
      sendResponse({ tabs: filtered });
    });
    return true;
  }

  // Get cached screenshot for a specific tab
  if (type === 'getScreenshot') {
    const cached = screenshotCache.get(tabId);
    if (cached && Date.now() - cached.ts < MAX_CACHE_AGE) {
      sendResponse({ success: true, dataUrl: cached.dataUrl, tabId, cached: true });
    } else {
      sendResponse({ success: false, tabId, cached: false });
    }
    return true;
  }

  // Request screenshot for a specific tab
  if (type === 'captureScreenshot') {
    captureTabScreenshot(tabId, quality || 'medium')
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message, tabId }));
    return true; // async
  }

  // Batch capture: request screenshots for multiple tabs
  if (type === 'captureAllScreenshots') {
    const tabIds = request.tabIds || [];
    const q = request.quality || 'medium';
    captureAllTabs(tabIds, q)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Content script response: screenshot captured
  if (type === 'screenshotResult') {
    handleScreenshotResult(tabId, request.dataUrl, request.error);
    // No sendResponse needed
    return true;
  }

  // Move tab
  if (type === 'moveTab') {
    chrome.tabs.move(tabId, { index: request.index }, (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  // Close tab
  if (type === 'closeTab') {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        screenshotCache.delete(tabId);
        sendResponse({ success: true });
      }
    });
    return true;
  }
});

// ============================================================
// Screenshot Capture
// ============================================================

/**
 * Capture screenshot for a single tab.
 * Uses chrome.tabs.sendMessage to reach the content script in that tab.
 */
async function captureTabScreenshot(tabId, quality = 'medium') {
  // Check cache first
  const cached = screenshotCache.get(tabId);
  if (cached && Date.now() - cached.ts < MAX_CACHE_AGE) {
    return { success: true, dataUrl: cached.dataUrl, tabId, cached: true };
  }

  // Deduplicate concurrent requests
  if (activeCaptures.has(tabId)) {
    return activeCaptures.get(tabId);
  }

  const promise = doCapture(tabId, quality);
  activeCaptures.set(tabId, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    activeCaptures.delete(tabId);
  }
}

async function doCapture(tabId, quality) {
  return new Promise((resolve) => {
    // Send message to content script in the target tab
    // The content script will call chrome.tabs.captureTab and reply
    chrome.tabs.sendMessage(tabId, {
      type: 'captureScreenshot',
      tabId,
      quality
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not available (chrome:// pages, about:, etc.)
        resolve({ success: false, error: chrome.runtime.lastError.message, tabId });
        return;
      }
      if (response && response.success) {
        screenshotCache.set(tabId, { dataUrl: response.dataUrl, ts: Date.now() });
        resolve({ success: true, dataUrl: response.dataUrl, tabId, cached: false });
      } else {
        resolve({ success: false, error: response?.error || 'Unknown error', tabId });
      }
    });

    // Timeout after 8 seconds
    setTimeout(() => {
      resolve({ success: false, error: 'Screenshot timeout', tabId });
    }, 8000);
  });
}

/**
 * Capture screenshots for multiple tabs with concurrency limit.
 */
async function captureAllTabs(tabIds, quality = 'medium') {
  const results = [];
  const queue = [...tabIds];
  const concurrency = 3;

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(processQueue());
  }

  async function processQueue() {
    while (queue.length > 0) {
      const tabId = queue.shift();
      const result = await captureTabScreenshot(tabId, quality);
      results.push(result);
    }
  }

  await Promise.all(workers);
  return results;
}

// ============================================================
// Result Handler (from content script via chrome.runtime.sendMessage)
// ============================================================

function handleScreenshotResult(tabId, dataUrl, error) {
  if (dataUrl) {
    screenshotCache.set(tabId, { dataUrl, ts: Date.now() });
  }
}

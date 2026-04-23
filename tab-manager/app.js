/**
 * Tab Manager - New Tab Extension
 * Drag-to-sort: mousedown + mousemove + mouseup (no pointer events, no drag API)
 * - Drag threshold: 5px movement to start drag
 * - Ghost clone follows cursor via GPU transform
 * - Drop indicator shows target position
 * - Click = tab navigation; drag-and-drop = sort (no navigation)
 */

const CONFIG_KEY = 'tabmanager_config';
const ORDER_KEY = 'tabmanager_order';

const DEFAULT_CONFIG = {
  minCardWidth: 200,
  quality: 'medium',
  theme: 'light',
  sortBy: 'manual'
};

let config = { ...DEFAULT_CONFIG };
let tabs = [];

// Drag state
let isDrag = false;           // true once threshold exceeded
let dragTabId = null;
let dragSrcCard = null;
let ghostEl = null;
let dropIndicatorEl = null;
let startX = 0, startY = 0;    // pointer coordinates at mousedown

// Card cache: tabId → DOM node
const cardCache = new Map();

const tabGrid = document.getElementById('tab-grid');
const loadingEl = document.getElementById('loading');
const tabCountEl = document.getElementById('tab-count');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const colsSlider = document.getElementById('cols-slider');
const colsLabel = document.getElementById('cols-label');
const qualitySelect = document.getElementById('quality-select');
const themeSelect = document.getElementById('theme-select');
const sortSelect = document.getElementById('sort-select');
const cardTemplate = document.getElementById('tab-card-template');

// ============================================================
// Init
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  loadConfig();
  applyConfig();
  bindEvents();
  await loadTabs();
});

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch (e) {}
}

function saveConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (e) {}
}

function applyConfig() {
  colsSlider.value = config.minCardWidth;
  colsLabel.textContent = config.minCardWidth;
  qualitySelect.value = config.quality;
  themeSelect.value = config.theme;
  sortSelect.value = config.sortBy;
  tabGrid.style.setProperty('--card-min-width', config.minCardWidth + 'px');
  if (config.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function bindEvents() {
  settingsBtn.addEventListener('click', e => { e.stopPropagation(); settingsPanel.classList.toggle('hidden'); });
  document.addEventListener('click', e => {
    if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
      settingsPanel.classList.add('hidden');
    }
  });

  colsSlider.addEventListener('input', () => {
    config.minCardWidth = parseInt(colsSlider.value);
    colsLabel.textContent = config.minCardWidth;
    tabGrid.style.setProperty('--card-min-width', config.minCardWidth + 'px');
    saveConfig();
  });

  qualitySelect.addEventListener('change', () => {
    config.quality = qualitySelect.value;
    saveConfig();
  });

  themeSelect.addEventListener('change', () => {
    config.theme = themeSelect.value;
    saveConfig();
    applyConfig();
  });

  sortSelect.addEventListener('change', () => {
    config.sortBy = sortSelect.value;
    saveConfig();
    sortAndRenderTabs();
  });

  if (!localStorage.getItem(CONFIG_KEY)) {
    config.minCardWidth = 200;
    saveConfig();
  }
  applyConfig();

  // Global mouse events for drag
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// ============================================================
// Tab Loading
// ============================================================

async function loadTabs() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getTabs' });
    if (resp.error) throw new Error(resp.error);
    tabs = resp.tabs || [];
    sortAndRenderTabs();
  } catch (e) {
    console.error('loadTabs failed:', e);
    showError('加载标签失败: ' + e.message);
  }
}

function showError(msg) {
  loadingEl.innerHTML = `<p style="color:#ef4444;font-size:13px">${msg}</p>`;
}

function sortAndRenderTabs() {
  const manualOrder = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
  if (config.sortBy === 'domain') {
    tabs.sort((a, b) => domain(a.url).localeCompare(domain(b.url)));
  } else if (config.sortBy === 'title') {
    tabs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (config.sortBy === 'lastAccessed') {
    tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  } else if (manualOrder.length > 0) {
    tabs.sort((a, b) => {
      const ia = manualOrder.indexOf(a.id);
      const ib = manualOrder.indexOf(b.id);
      if (ia === -1 && ib === -1) return (a.index || 0) - (b.index || 0);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }
  renderTabs();
}

function domain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function saveOrder() {
  localStorage.setItem(ORDER_KEY, JSON.stringify(tabs.map(t => t.id)));
}

// ============================================================
// Rendering
// ============================================================

function renderTabs() {
  loadingEl.classList.add('hidden');
  tabCountEl.textContent = `${tabs.length} 个标签`;

  const neededIds = new Set(tabs.map(t => t.id));

  cardCache.forEach((card, tabId) => {
    if (!neededIds.has(tabId)) {
      card.remove();
      cardCache.delete(tabId);
    }
  });

  tabs.forEach(tab => {
    if (cardCache.has(tab.id)) {
      const card = cardCache.get(tab.id);
      tabGrid.appendChild(card);
      card.querySelector('.tab-domain').textContent = domain(tab.url);
      const titleEl = card.querySelector('.tab-title');
      titleEl.textContent = tab.title || '无标题';
      titleEl.title = tab.title || tab.url;
    } else {
      const card = buildCard(tab);
      cardCache.set(tab.id, card);
      tabGrid.appendChild(card);
    }
  });

  loadPendingFavicons();
}

function buildCard(tab) {
  const tpl = cardTemplate.content.cloneNode(true);
  const card = tpl.querySelector('.tab-card');
  card.dataset.tabId = tab.id;

  const dom = domain(tab.url);
  card.querySelector('.tab-domain').textContent = dom;
  const titleEl = card.querySelector('.tab-title');
  titleEl.textContent = tab.title || '无标题';
  titleEl.title = tab.title || tab.url;

  // Click → navigate to tab (only if NOT a drag)
  card.addEventListener('click', e => {
    if (e.target.closest('.tab-close')) return;
    // isDrag is reset to false in mouseup BEFORE click fires
    // So if isDrag is true → this was a drag-drop, skip navigation
    if (isDrag) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    chrome.tabs.update(tab.id, { active: true }).then(() => {
      chrome.windows.update(tab.windowId || chrome.windows.WINDOW_ID_CURRENT, { focused: true });
    });
  });

  // Close button
  card.querySelector('.tab-close').addEventListener('click', e => {
    e.stopPropagation();
    closeTab(tab.id);
  });

  // Drag start on mousedown
  card.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(tab.id, card, e.clientX, e.clientY);
  });

  // Also prevent default drag behavior on this element
  card.addEventListener('dragstart', e => e.preventDefault());

  return card;
}

// ============================================================
// Drag System
// ============================================================

function startDrag(tabId, card, clientX, clientY) {
  isDrag = false;
  dragTabId = tabId;
  dragSrcCard = card;
  startX = clientX;
  startY = clientY;

  card.classList.add('dragging');
  createGhost(card, clientX, clientY);
}

function createGhost(card, clientX, clientY) {
  ghostEl = card.cloneNode(true);
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  ghostEl.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    width: ${w}px;
    height: ${h}px;
    left: 0;
    top: 0;
    opacity: 0.92;
    border-color: var(--accent) !important;
    box-shadow: 0 16px 48px rgba(0,0,0,0.25);
    will-change: transform;
    contain: layout style paint;
  `;
  const x = clientX - w / 2;
  const y = clientY - h / 2;
  ghostEl.style.transform = `translate(${x}px,${y}px) rotate(2deg) scale(1.05)`;
  document.body.appendChild(ghostEl);
}

function moveGhost(clientX, clientY) {
  if (!ghostEl) return;
  const w = ghostEl.offsetWidth;
  const h = ghostEl.offsetHeight;
  ghostEl.style.transform = `translate(${clientX - w / 2}px,${clientY - h / 2}px) rotate(2deg) scale(1.05)`;
}

function destroyGhost() {
  if (ghostEl) {
    ghostEl.remove();
    ghostEl = null;
  }
}

// ============================================================
// Global mousemove — threshold check + ghost move + indicator
// ============================================================

function onMouseMove(e) {
  if (!dragTabId) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  // Activate drag only after 5px of movement
  if (!isDrag && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    isDrag = true;
  }

  if (!isDrag) return;

  moveGhost(e.clientX, e.clientY);

  // Find which card is under cursor
  const targetCard = getCardAtPoint(e.clientX, e.clientY);

  cardCache.forEach(c => c.classList.remove('drag-over'));

  if (targetCard && targetCard !== dragSrcCard) {
    targetCard.classList.add('drag-over');
    showDropIndicatorBefore(targetCard);
  } else {
    removeDropIndicator();
  }
}

// ============================================================
// Global mouseup — execute drop
// ============================================================

function onMouseUp(e) {
  if (!dragTabId) return;

  const didDrag = isDrag;

  // Always clean up
  destroyGhost();
  removeDropIndicator();

  if (dragSrcCard) {
    dragSrcCard.classList.remove('dragging');
  }

  // If we were dragging and dropped on a different card
  if (didDrag && dragSrcCard) {
    const targetCard = getCardAtPoint(e.clientX, e.clientY);
    if (targetCard && targetCard !== dragSrcCard) {
      const fromId = dragTabId;
      const toId = parseInt(targetCard.dataset.tabId);
      if (fromId && toId && fromId !== toId) {
        executeSort(fromId, toId, targetCard);
      }
    }
  }

  // Reset drag state — isDrag = false so subsequent click is allowed
  dragTabId = null;
  dragSrcCard = null;
  isDrag = false;
}

// ============================================================
// Drop indicator
// ============================================================

function showDropIndicatorBefore(targetCard) {
  if (!dropIndicatorEl) {
    dropIndicatorEl = document.createElement('div');
    dropIndicatorEl.className = 'drop-indicator';
  }
  dropIndicatorEl.remove();
  tabGrid.insertBefore(dropIndicatorEl, targetCard);
}

function removeDropIndicator() {
  if (dropIndicatorEl && dropIndicatorEl.parentNode) {
    dropIndicatorEl.remove();
  }
}

// ============================================================
// Hit test
// ============================================================

function getCardAtPoint(x, y) {
  // Temporarily hide ghost so it doesn't block hit testing
  if (ghostEl) ghostEl.style.visibility = 'hidden';
  const el = document.elementFromPoint(x, y);
  if (ghostEl) ghostEl.style.visibility = '';

  let card = el;
  while (card && !card.classList.contains('tab-card')) {
    card = card.parentElement;
  }
  return card;
}

// ============================================================
// Sort logic
// ============================================================

function executeSort(fromId, toId, targetCard) {
  if (config.sortBy !== 'manual') {
    config.sortBy = 'manual';
    sortSelect.value = 'manual';
    saveConfig();
  }

  const fromIdx = tabs.findIndex(t => t.id === fromId);
  const toIdx = tabs.findIndex(t => t.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

  const [moved] = tabs.splice(fromIdx, 1);
  tabs.splice(toIdx, 0, moved);

  // chrome.tabs.move index: position tab WILL be at after move
  const isBackward = fromIdx > toIdx;
  const moveIndex = isBackward ? toIdx : toIdx - 1;

  console.log('[TM] SORT', { fromId, toId, fromIdx, toIdx, isBackward, moveIndex });

  chrome.runtime.sendMessage({ type: 'moveTab', tabId: fromId, index: moveIndex }).then(() => {
    saveOrder();
    renderTabs();
  }).catch(err => {
    console.error('[TM] moveTab err:', err);
    saveOrder();
    renderTabs();
  });
}

// ============================================================
// Favicon Loading
// ============================================================

function loadPendingFavicons() {
  tabs.forEach((tab, i) => {
    const card = cardCache.get(tab.id);
    if (!card) return;
    const faviconEl = card.querySelector('.tab-favicon');
    if (!faviconEl.getAttribute('src')) {
      setTimeout(() => loadFavicon(tab.id, tab.url, tab.favIconUrl), i * 50);
    }
  });
}

function loadFavicon(tabId, tabUrl, browserFavicon) {
  const card = cardCache.get(tabId);
  if (!card) return;
  const faviconEl = card.querySelector('.tab-favicon');
  if (!faviconEl) return;

  if (browserFavicon && browserFavicon.startsWith('http')) {
    const img = new Image();
    img.onload = () => { faviconEl.src = browserFavicon; };
    img.onerror = () => tryGoogleFavicon(tabId, tabUrl, faviconEl);
    img.src = browserFavicon;
    return;
  }
  tryGoogleFavicon(tabId, tabUrl, faviconEl);
}

function tryGoogleFavicon(tabId, tabUrl, faviconEl) {
  const dom = domain(tabUrl);
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=64`;
  const img = new Image();
  img.onload = () => { faviconEl.src = url; };
  img.onerror = () => { faviconEl.src = ''; };
  img.src = url;
}

// ============================================================
// Tab Close
// ============================================================

async function closeTab(tabId) {
  const card = cardCache.get(tabId);
  if (card) card.classList.add('removing');
  await sleep(220);

  try {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx > -1) tabs.splice(idx, 1);
    await chrome.tabs.remove(tabId);

    if (card) {
      card.remove();
      cardCache.delete(tabId);
    }

    tabCountEl.textContent = `${tabs.length} 个标签`;

    if (tabs.length === 0) {
      tabGrid.innerHTML = `
        <div class="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
          <p>没有其他标签页</p>
        </div>`;
    }
  } catch (e) {
    console.error('closeTab failed:', e);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

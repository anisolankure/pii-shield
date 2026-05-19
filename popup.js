/**
 * PII Shield — Popup JS
 */

const masterToggle   = document.getElementById('master-toggle');
const toggleHighlight = document.getElementById('toggle-highlight');
const toggleSidePanel = document.getElementById('toggle-sidepanel');
const statusChip     = document.getElementById('pop-status-chip');
const statusText     = document.getElementById('status-text');
const statSession    = document.getElementById('stat-session');
const statTotal      = document.getElementById('stat-total');
const btnOpenPanel   = document.getElementById('btn-open-panel');
const btnPrivacy     = document.getElementById('btn-privacy');

async function init() {
  // Load settings
  const stored = await chrome.storage.sync.get(['settings', 'stats']);
  const s = stored.settings || {};
  const stats = stored.stats || { session: 0, total: 0 };

  masterToggle.checked   = s.enabled !== false;
  toggleHighlight.checked = s.highlightEnabled !== false;
  toggleSidePanel.checked = s.sidePanelEnabled !== false;

  statSession.textContent = stats.session || 0;
  statTotal.textContent   = stats.total   || 0;

  updateStatusChip(masterToggle.checked);

  // Check if on supported site
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) checkIfSupported(tab.url);

  // Event listeners
  masterToggle.addEventListener('change', saveSettings);
  toggleHighlight.addEventListener('change', saveSettings);
  toggleSidePanel.addEventListener('change', saveSettings);

  btnOpenPanel.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  });

  btnPrivacy.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://anisolankure.github.io/pii-shield/privacy-policy' });
  });
}

function checkIfSupported(url) {
  const SUPPORTED = [
    'chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com',
    'copilot.microsoft.com', 'bing.com', 'perplexity.ai', 'huggingface.co', 'grok.com', 'x.com'
  ];
  const isSupported = SUPPORTED.some(s => url?.includes(s));
  if (!isSupported) {
    statusText.textContent = 'Not an AI site — open a supported AI tool';
    statusChip.className = 'status-inactive';
  }
}

async function saveSettings() {
  const settings = {
    enabled:          masterToggle.checked,
    highlightEnabled: toggleHighlight.checked,
    sidePanelEnabled: toggleSidePanel.checked
  };
  await chrome.storage.sync.set({ settings });
  updateStatusChip(settings.enabled);

  // Notify content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings }).catch(() => {});
  }
}

function updateStatusChip(enabled) {
  if (enabled) {
    statusChip.className = 'status-active';
    statusText.textContent = 'Protected on this site';
  } else {
    statusChip.className = 'status-inactive';
    statusText.textContent = 'Protection disabled';
  }
}

init();

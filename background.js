/**
 * PII Shield — Background Service Worker
 */

let latestFindings = [];
let latestSite = '';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PII_DETECTED') {
    latestFindings = msg.findings || [];
    latestSite = msg.site || '';
    updateBadge(latestFindings.length, sender.tab?.id);
    // Forward to side panel if open
    chrome.runtime.sendMessage({ type: 'UPDATE_PANEL', findings: latestFindings, site: latestSite }).catch(() => {});
  }

  if (msg.type === 'PII_CLEARED') {
    latestFindings = [];
    updateBadge(0, sender.tab?.id);
    chrome.runtime.sendMessage({ type: 'UPDATE_PANEL', findings: [], site: latestSite }).catch(() => {});
  }

  if (msg.type === 'OPEN_SIDE_PANEL') {
    chrome.sidePanel.open({ tabId: sender.tab?.id }).catch(() => {});
  }

  if (msg.type === 'GET_FINDINGS') {
    sendResponse({ findings: latestFindings, site: latestSite });
    return true;
  }
});

// Keyboard shortcut to toggle side panel
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-side-panel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});

function updateBadge(count, tabId) {
  const text = count > 0 ? String(count) : '';
  const color = count > 0 ? '#ef4444' : '#6b7280';
  if (tabId) {
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  } else {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

// Side panel settings
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

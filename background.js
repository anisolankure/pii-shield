let latestText = '';
let latestRegexFindings = [];
let latestCombinedFindings = [];
let latestSite = '';
let latestTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PII_INPUT_CHANGED') {
    latestText = msg.text || '';
    latestRegexFindings = msg.regexFindings || [];
    latestSite = msg.site || '';
    latestTabId = sender.tab?.id || null;
    
    // Default badge update using regex findings until AI scan updates it
    updateBadge(latestRegexFindings.length, latestTabId);
    
    // Forward to side panel with tab ID context
    chrome.runtime.sendMessage({
      type: 'UPDATE_INPUT',
      text: latestText,
      regexFindings: latestRegexFindings,
      site: latestSite,
      tabId: latestTabId
    }).catch(() => {});
  }

  if (msg.type === 'PII_CLEARED') {
    latestText = '';
    latestRegexFindings = [];
    latestCombinedFindings = [];
    latestTabId = sender.tab?.id || latestTabId;
    updateBadge(0, latestTabId);
    
    chrome.runtime.sendMessage({
      type: 'UPDATE_INPUT',
      text: '',
      regexFindings: [],
      site: latestSite,
      tabId: latestTabId
    }).catch(() => {});
  }

  if (msg.type === 'OPEN_SIDE_PANEL') {
    chrome.sidePanel.open({ tabId: sender.tab?.id }).catch(() => {});
  }

  if (msg.type === 'GET_FINDINGS') {
    sendResponse({
      text: latestText,
      regexFindings: latestRegexFindings,
      combinedFindings: latestCombinedFindings,
      site: latestSite,
      tabId: latestTabId
    });
    return true;
  }

  if (msg.type === 'UPDATE_COMBINED_FINDINGS') {
    latestCombinedFindings = msg.findings || [];
    const targetTabId = msg.tabId || latestTabId;
    updateBadge(latestCombinedFindings.length, targetTabId);
    
    // Forward combined findings back to active tab to highlight AI detections
    if (targetTabId) {
      chrome.tabs.sendMessage(targetTabId, {
        type: 'AI_FINDINGS_DETECTED',
        findings: latestCombinedFindings
      }).catch(() => {});
    }
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

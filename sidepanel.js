/**
 * PII Shield — Side Panel JS
 */

const SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };

let findings = [];

// ── DOM refs ─────────────────────────────────────────────────────────────

const countBadge     = document.getElementById('sp-count-badge');
const clearBtn       = document.getElementById('sp-clear-btn');
const copyBtn        = document.getElementById('sp-copy-btn');
const findingsList   = document.getElementById('sp-findings-list');
const emptyState     = document.getElementById('sp-empty-state');
const findingsHeader = document.getElementById('sp-findings-header');
const siteName       = document.getElementById('sp-site-name');
const enabledToggle  = document.getElementById('sp-enabled-toggle');
const countHigh      = document.getElementById('count-high');
const countMedium    = document.getElementById('count-medium');
const countLow       = document.getElementById('count-low');
const cardHigh       = document.getElementById('card-high');
const cardMedium     = document.getElementById('card-medium');
const cardLow        = document.getElementById('card-low');

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  // Load settings
  const stored = await chrome.storage.sync.get(['settings']);
  if (stored.settings?.enabled === false) enabledToggle.checked = false;

  // Get current findings from background
  chrome.runtime.sendMessage({ type: 'GET_FINDINGS' }, (res) => {
    if (res?.findings?.length) renderFindings(res.findings, res.site);
  });

  // Listen for live updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'UPDATE_PANEL') {
      renderFindings(msg.findings || [], msg.site || '');
    }
  });

  // Controls
  enabledToggle.addEventListener('change', () => {
    const enabled = enabledToggle.checked;
    chrome.storage.sync.set({ settings: { enabled } });
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: { enabled } }).catch(() => {});
    });
  });

  clearBtn.addEventListener('click', () => renderFindings([], ''));

  copyBtn.addEventListener('click', copyToClipboard);
}

// ── Render ────────────────────────────────────────────────────────────────

function renderFindings(data, site) {
  findings = data;

  // Update site display
  siteName.textContent = site ? cleanHostname(site) : 'No active site';

  // Update counts
  const high   = data.filter(f => f.severity === 'high').length;
  const medium = data.filter(f => f.severity === 'medium').length;
  const low    = data.filter(f => f.severity === 'low').length;

  countHigh.textContent   = high;
  countMedium.textContent = medium;
  countLow.textContent    = low;

  cardHigh.classList.toggle('has-items', high > 0);
  cardMedium.classList.toggle('has-items', medium > 0);
  cardLow.classList.toggle('has-items', low > 0);

  if (data.length === 0) {
    emptyState.classList.remove('hidden');
    findingsHeader.classList.add('hidden');
    clearBtn.classList.add('hidden');
    countBadge.classList.add('hidden');
    // Clear items from list keeping empty state
    findingsList.querySelectorAll('.finding-item').forEach(el => el.remove());
    return;
  }

  emptyState.classList.add('hidden');
  findingsHeader.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
  countBadge.classList.remove('hidden');
  countBadge.textContent = data.length;

  // Sort by severity
  const sorted = [...data].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  // Remove old items
  findingsList.querySelectorAll('.finding-item').forEach(el => el.remove());

  for (const f of sorted) {
    findingsList.appendChild(buildFindingItem(f));
  }
}

function buildFindingItem(f) {
  const item = document.createElement('div');
  item.className = 'finding-item';
  item.innerHTML = `
    <div class="finding-dot ${f.severity}"></div>
    <div class="finding-body">
      <div class="finding-label">${escHtml(f.label)}</div>
      <div class="finding-value" title="${escHtml(f.match)}">${escHtml(f.match)}</div>
    </div>
    <div class="finding-badge ${f.severity}">${f.severity}</div>
  `;
  return item;
}

// ── Copy to clipboard ──────────────────────────────────────────────────────

function copyToClipboard() {
  if (!findings.length) return;
  const lines = ['PII Shield — Detection Report', `Site: ${siteName.textContent}`, ''];
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  for (const f of sorted) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.label}: ${f.match}`);
  }
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const orig = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => copyBtn.textContent = orig, 2000);
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cleanHostname(h) {
  return h.replace(/^www\./, '');
}

init();

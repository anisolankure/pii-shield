/**
 * PII Shield — Side Panel JS
 * Implements V2 Hybrid AI + Pattern PII Scanning Engine
 */

import { env, pipeline } from './lib/transformers.js';

const SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };

let findings = [];
let classifier = null;
let isModelLoading = false;
let currentText = '';
let currentRegexFindings = [];
let currentTabId = null;
let scanDebounceTimer = null;

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

// AI Status elements
const aiPulse        = document.getElementById('sp-ai-pulse');
const aiStatusText   = document.getElementById('sp-ai-status-text');

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  // Get active tab ID initially
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      currentTabId = tabs[0].id;
    }
  });

  // Load settings
  const stored = await chrome.storage.sync.get(['settings']);
  if (stored.settings?.enabled === false) enabledToggle.checked = false;

  // Listen for active tab transitions to update currentTabId dynamically
  chrome.tabs.onActivated.addListener((activeInfo) => {
    currentTabId = activeInfo.tabId;
  });

  // Load the AI classifier immediately in background
  ensureClassifierLoaded();

  // Get current findings from background (if sidepanel just boot up)
  chrome.runtime.sendMessage({ type: 'GET_FINDINGS' }, (res) => {
    if (res) {
      currentText = res.text || '';
      currentRegexFindings = res.regexFindings || [];
      currentTabId = res.tabId || currentTabId;
      if (res.site) siteName.textContent = cleanHostname(res.site);
      
      if (currentText.trim().length >= 3) {
        triggerHybridScan(currentText, currentRegexFindings);
      } else {
        renderFindings([], res.site || '');
      }
    }
  });

  // Listen for live input changes from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'UPDATE_INPUT') {
      currentText = msg.text || '';
      currentRegexFindings = msg.regexFindings || [];
      currentTabId = msg.tabId || currentTabId;
      if (msg.site) siteName.textContent = cleanHostname(msg.site);
      
      if (currentText.trim().length >= 3) {
        triggerHybridScan(currentText, currentRegexFindings);
      } else {
        renderFindings([], msg.site || '');
        // Notify background that findings are cleared
        chrome.runtime.sendMessage({
          type: 'UPDATE_COMBINED_FINDINGS',
          findings: [],
          tabId: currentTabId
        }).catch(() => {});
      }
    }
  });

  // Controls with safe settings preservation
  enabledToggle.addEventListener('change', async () => {
    const enabled = enabledToggle.checked;
    const stored = await chrome.storage.sync.get(['settings']);
    const newSettings = { ...stored.settings, enabled };
    await chrome.storage.sync.set({ settings: newSettings });
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: 'SETTINGS_UPDATED', settings: newSettings }).catch(() => {});
    }
  });

  clearBtn.addEventListener('click', () => {
    currentText = '';
    currentRegexFindings = [];
    renderFindings([], '');
    chrome.runtime.sendMessage({
      type: 'UPDATE_COMBINED_FINDINGS',
      findings: [],
      tabId: currentTabId
    }).catch(() => {});
  });

  copyBtn.addEventListener('click', copyToClipboard);
}

// ── AI Engine Management ──────────────────────────────────────────────────

async function ensureClassifierLoaded() {
  if (classifier) return classifier;
  if (isModelLoading) return null;

  isModelLoading = true;
  aiPulse.className = 'ai-status-pulse loading';
  aiStatusText.textContent = '⏳ Loading AI Privacy Guard...';

  try {
    const extensionUrl = chrome.runtime.getURL('');
    env.localModelPath = `${extensionUrl}models/`;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    env.backends.onnx.wasm.wasmPaths = `${extensionUrl}lib/`;
    env.backends.onnx.wasm.numThreads = 1;

    classifier = await pipeline('token-classification', 'pii', {
      quantized: true
    });

    aiPulse.className = 'ai-status-pulse ready';
    aiStatusText.textContent = 'AI Engine Ready ⚡';
    isModelLoading = false;

    // If there is pending text, evaluate it immediately now that the model is loaded!
    if (currentText.trim().length >= 3) {
      triggerHybridScan(currentText, currentRegexFindings);
    }

    return classifier;
  } catch (err) {
    aiPulse.className = 'ai-status-pulse offline';
    aiStatusText.textContent = `❌ AI Engine Offline: ${err.message}`;
    isModelLoading = false;
    console.error('Error loading AI model:', err);
    return null;
  }
}

// ── Hybrid Scan Engine ────────────────────────────────────────────────────

function triggerHybridScan(text, regexFindings) {
  // 1. Snappy UI: Render regex findings instantly!
  renderFindings(regexFindings, siteName.textContent);

  // 2. Debounce and schedule heavy AI model scanning
  clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(async () => {
    if (!classifier) {
      const loaded = await ensureClassifierLoaded();
      if (!loaded) return; // Wait for loader
    }

    try {
      // Glow AI status pulse during active evaluation
      aiPulse.classList.add('loading');
      
      const results = await classifier(text);
      const aiFindings = processModelResults(results, text);
      const combinedFindings = combineAndDeduplicate(regexFindings, aiFindings);

      // Render the merged deduplicated list
      renderFindings(combinedFindings, siteName.textContent);

      // Update background process with merged findings (sets badge, triggers highlight sync)
      chrome.runtime.sendMessage({
        type: 'UPDATE_COMBINED_FINDINGS',
        findings: combinedFindings,
        tabId: currentTabId
      }).catch(() => {});

    } catch (err) {
      console.error('AI evaluation failed:', err);
    } finally {
      aiPulse.classList.remove('loading');
    }
  }, 250);
}

// ── BERT Entity Post-Processing & WordPiece Merging ───────────────────────

function processModelResults(results, text) {
  if (!results || results.length === 0) return [];
  
  const entities = [];
  let currentEntity = null;
  
  // Sort results by original starting position
  results.sort((a, b) => a.index - b.index);
  
  for (const item of results) {
    const match = item.entity.match(/^[BI]-(.+)$/);
    if (!match) continue;
    const entityType = match[1];
    
    const isSubword = item.word.startsWith('##');
    const cleanWord = isSubword ? item.word.slice(2) : item.word;
    
    // Merge criteria: same type OR is subword (forced append)
    if (currentEntity && 
        ((entityType === currentEntity.type) || isSubword) && 
        (item.entity.startsWith('I-') || isSubword || (item.start <= currentEntity.end + 2))) {
      
      currentEntity.word += (isSubword ? '' : ' ') + cleanWord;
      currentEntity.end = item.end;
      currentEntity.score = Math.min(currentEntity.score, item.score); // conservative score
    } else {
      // Stray subwords cannot start a new entity sequence
      if (isSubword) {
        if (currentEntity) {
          currentEntity.word += cleanWord;
          currentEntity.end = item.end;
        }
        continue;
      }
      
      if (currentEntity) entities.push(currentEntity);
      
      currentEntity = {
        type: entityType,
        word: cleanWord,
        start: item.start,
        end: item.end,
        score: item.score
      };
    }
  }
  
  if (currentEntity) entities.push(currentEntity);
  
  const severityMap = {
    'CREDIT_CARD': 'high',
    'US_SSN': 'high',
    'US_PASSPORT': 'high',
    'PASSWORD': 'high',
    'PERSON': 'medium',
    'EMAIL_ADDRESS': 'medium',
    'PHONE_NUMBER': 'medium',
    'IP_ADDRESS': 'medium',
    'FINANCIAL': 'medium',
    'IBAN_CODE': 'medium',
    'LOCATION': 'low',
    'ORGANIZATION': 'low',
    'DATE_TIME': 'low',
    'AGE': 'low',
    'URL': 'low'
  };
  
  const labelMap = {
    'PERSON': 'Person Name',
    'ORGANIZATION': 'Organization',
    'LOCATION': 'Location / Address',
    'CREDIT_CARD': 'Credit Card',
    'EMAIL_ADDRESS': 'Email Address',
    'PHONE_NUMBER': 'Phone Number',
    'PASSWORD': 'Password',
    'IP_ADDRESS': 'IP Address',
    'US_SSN': 'US SSN',
    'US_PASSPORT': 'US Passport',
    'FINANCIAL': 'Financial Detail',
    'IBAN_CODE': 'IBAN Code',
    'DATE_TIME': 'Date / Time',
    'AGE': 'Age',
    'URL': 'URL Link'
  };
  
  const colorMap = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#eab308'
  };
  
  return entities
    .filter(ent => ['PERSON', 'ORGANIZATION', 'LOCATION'].includes(ent.type))
    .map(ent => {
      const sev = severityMap[ent.type] || 'low';
      const matchText = text.substring(ent.start, ent.end) || ent.word;
      return {
        patternId: 'ai_' + ent.type.toLowerCase(),
        label: labelMap[ent.type] || ent.type,
        severity: sev,
        color: colorMap[sev],
        match: matchText,
        index: ent.start,
        end: ent.end,
        description: `Identified by local AI model (Confidence: ${Math.round(ent.score * 100)}%)`,
        isAI: true
      };
    })
    .filter(f => {
      const cleanVal = f.match.trim();
      
      // General categories must be at least 2 characters
      if (cleanVal.length < 2) return false;
      
      // Discard numbers classified as PERSON, LOCATION or ORGANIZATION
      if (/^\d+$/.test(cleanVal)) return false;
      
      return true;
    });
}

// ── Overlap & Boundary Deduplication ─────────────────────────────────────

function combineAndDeduplicate(regexFindings, aiFindings) {
  const combined = [...regexFindings, ...aiFindings];
  
  combined.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return (b.end - b.index) - (a.end - a.index);
  });
  
  const result = [];
  let lastEnd = -1;
  
  for (const f of combined) {
    if (f.index < lastEnd) {
      const prev = result[result.length - 1];
      const prevSev = SEVERITY_ORDER[prev.severity] || 0;
      const currSev = SEVERITY_ORDER[f.severity] || 0;
      
      // Override if current overlaps but is higher risk, otherwise discard overlap
      if (currSev > prevSev) {
        result.pop();
        result.push(f);
        lastEnd = f.end;
      }
    } else {
      result.push(f);
      lastEnd = f.end;
    }
  }
  
  return result;
}

// ── Render Dashboard UI ───────────────────────────────────────────────────

function renderFindings(data, site) {
  findings = data;
  siteName.textContent = site ? cleanHostname(site) : 'No active site';

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
    findingsList.querySelectorAll('.finding-item').forEach(el => el.remove());
    return;
  }

  emptyState.classList.add('hidden');
  findingsHeader.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
  countBadge.classList.remove('hidden');
  countBadge.textContent = data.length;

  const sorted = [...data].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  findingsList.querySelectorAll('.finding-item').forEach(el => el.remove());

  for (const f of sorted) {
    findingsList.appendChild(buildFindingItem(f));
  }
}

function buildFindingItem(f) {
  const item = document.createElement('div');
  item.className = 'finding-item';
  
  const sourceTag = f.isAI 
    ? `<span class="detection-source-badge ai">AI Scan</span>`
    : `<span class="detection-source-badge pattern">Pattern</span>`;

  item.innerHTML = `
    <div class="finding-dot ${f.severity}"></div>
    <div class="finding-body">
      <div class="finding-label">
        ${escHtml(f.label)}
        ${sourceTag}
      </div>
      <div class="finding-value" title="${escHtml(f.match)}">${escHtml(f.match)}</div>
    </div>
    <div class="finding-badge ${f.severity}">${f.severity}</div>
  `;
  return item;
}

// ── Copy Report ───────────────────────────────────────────────────────────

function copyToClipboard() {
  if (!findings.length) return;
  const lines = ['🛡️ PII Shield — Detection Report', `Site: ${siteName.textContent}`, ''];
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  for (const f of sorted) {
    const src = f.isAI ? 'AI Scan' : 'Pattern Match';
    lines.push(`[${f.severity.toUpperCase()}] ${f.label} (${src}): ${f.match}`);
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
  if (!h) return '';
  return h.replace(/^www\./, '');
}

// ── Diagnostics Test Action ───────────────────────────────────────────────
document.getElementById('btn-test-slm')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('slm-status');
  statusEl.innerText = 'Initializing local PII neural network...';
  statusEl.style.color = '#f59e0b';
  statusEl.style.textAlign = 'left';
  
  try {
    const loaded = await ensureClassifierLoaded();
    if (!loaded) throw new Error("Could not initialize the classifier pipeline.");
    
    statusEl.innerText = '⚡ Model loaded! Analyzing sample prompt...';
    
    const text = "Hi, my name is Sarah Connor and I work for Skynet in Cyberdyne. Email me at sarah@connor.com.";
    const results = await classifier(text);
    
    if (!results || results.length === 0) {
      statusEl.style.color = '#f59e0b';
      statusEl.innerText = '✅ Scan complete: No complex PII found in sample.';
      return;
    }
    
    const outputLines = [
      '✅ Local PII Neural Network works!',
      `Analyzed: "${text}"`,
      '',
      'Detected Entities:'
    ];
    
    results.forEach(item => {
      outputLines.push(`• "${item.word}" ➔ Type: ${item.entity} (Score: ${Math.round(item.score * 100)}%)`);
    });
    
    statusEl.style.color = '#22c55e';
    statusEl.innerText = outputLines.join('\n');
    
  } catch (err) {
    statusEl.style.color = '#ef4444';
    statusEl.innerText = `❌ Error: ${err.message}`;
  }
});

init();

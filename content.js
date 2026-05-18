/**
 * PII Shield — Content Script
 * Monitors AI chat inputs for PII and triggers warnings.
 */

const SITE_SELECTORS = {
  'chatgpt.com': ['#prompt-textarea', 'div[contenteditable="true"]'],
  'chat.openai.com': ['#prompt-textarea', 'div[contenteditable="true"]'],
  'claude.ai': ['.ProseMirror', 'div[contenteditable="true"]'],
  'gemini.google.com': ['.ql-editor', 'div[contenteditable="true"]'],
  'copilot.microsoft.com': ['#searchbox', 'textarea', 'div[contenteditable="true"]'],
  'bing.com': ['#searchbox', 'textarea'],
  'perplexity.ai': ['textarea', 'div[contenteditable="true"]'],
  'huggingface.co': ['textarea'],
  'grok.com': ['div[contenteditable="true"]', 'textarea'],
  'x.com': ['div[contenteditable="true"]']
};

const EXEMPT_INPUT_TYPES = new Set(['email', 'tel', 'password', 'search', 'hidden']);
const EXEMPT_AUTOCOMPLETE = new Set([
  'email', 'tel', 'phone', 'name', 'given-name', 'family-name',
  'street-address', 'postal-code', 'bday', 'cc-number'
]);

const HIGHLIGHT_CLASS = 'pii-shield-highlight';
const OVERLAY_CLASS = 'pii-shield-overlay';

let currentFindings = [];
let debounceTimer = null;
let observedElements = new Set();
let settings = { enabled: true, highlightEnabled: true, sidePanelEnabled: true };
let toastShownThisSession = false;
let toastEl = null;

async function init() {
  const stored = await chrome.storage.sync.get(['settings']);
  if (stored.settings) settings = { ...settings, ...stored.settings };
  if (!settings.enabled) return;

  observeInputElements();
  const observer = new MutationObserver(debounce(observeInputElements, 500));
  observer.observe(document.body, { childList: true, subtree: true });
  chrome.runtime.onMessage.addListener(handleMessage);
}

function observeInputElements() {
  const hostname = location.hostname.replace(/^www\./, '');
  const selectors = SITE_SELECTORS[hostname] || ['div[contenteditable="true"]', 'textarea'];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach(el => {
      if (observedElements.has(el) || isExemptElement(el)) return;
      attachListener(el);
      observedElements.add(el);
    });
  }
}

function isExemptElement(el) {
  if (el.tagName === 'INPUT' && EXEMPT_INPUT_TYPES.has(el.type?.toLowerCase())) return true;
  const ac = el.getAttribute('autocomplete') || '';
  if (EXEMPT_AUTOCOMPLETE.has(ac)) return true;
  if (el.closest('form[action]')) return true;
  return false;
}

function attachListener(el) {
  const handler = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => handleInput(el), 300);
  };
  el.addEventListener('input', handler);
  el.addEventListener('paste', () => setTimeout(handler, 100));
}

function handleInput(el) {
  const text = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? el.value : (el.innerText || '');
  if (!text || text.trim().length < 3) { clearHighlights(el); return; }

  const findings = window.PIIEngine.scanText(text);
  currentFindings = findings;

  if (findings.length === 0) {
    clearHighlights(el);
    notifyBg({ type: 'PII_CLEARED' });
    return;
  }

  if (settings.highlightEnabled) applyHighlights(el, text, findings);

  if (settings.sidePanelEnabled) {
    notifyBg({
      type: 'PII_DETECTED',
      findings: findings.map(f => ({
        label: f.label, severity: f.severity, color: f.color,
        match: maskPII(f.match, f.patternId), description: f.description
      })),
      site: location.hostname
    });
  }

  if (!toastShownThisSession) { toastShownThisSession = true; showToast(findings); }
}

// ── Highlights ─────────────────────────────────────────────────────────────

function applyHighlights(el, text, findings) {
  // Only apply the overlay on plain textarea/input elements where font
  // mirroring is reliable. contenteditable divs (used by ChatGPT, Claude,
  // Gemini etc.) have complex rich-text rendering that makes pixel-perfect
  // overlay alignment impossible across all sites. The side panel + toast
  // provide full coverage for those elements instead.
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    applyOverlay(el, text, findings);
  }
  // For contenteditable: no highlight — side panel and toast handle it.
}

function applyOverlay(el, text, findings) {
  // Get or create the transparent highlight overlay
  let overlay = el._piiOverlay;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.setAttribute('aria-hidden', 'true'); // invisible to screen readers
    el._piiOverlay = overlay;

    // The overlay must be a sibling so it sits on top without being inside the input
    const parent = el.parentElement;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(overlay);
  }

  // Mirror the exact position and font of the source element
  const cs = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const parentRect = el.parentElement.getBoundingClientRect();
  overlay.style.cssText = [
    `position:absolute`,
    `top:${el.offsetTop}px`,
    `left:${el.offsetLeft}px`,
    `width:${el.offsetWidth}px`,
    `height:${el.offsetHeight}px`,
    `padding:${cs.padding}`,
    `font:${cs.font}`,
    `font-size:${cs.fontSize}`,
    `line-height:${cs.lineHeight}`,
    `letter-spacing:${cs.letterSpacing}`,
    `white-space:pre-wrap`,
    `word-wrap:break-word`,
    `overflow-wrap:break-word`,
    `color:transparent`,   // text is invisible — only the marks show
    `pointer-events:none`, // clicks pass through to the real input
    `overflow:hidden`,
    `z-index:2147483640`,
    `box-sizing:border-box`,
  ].join(';');

  // Build highlighted HTML — text colour is transparent so only the underline mark is visible
  let html = '';
  let last = 0;
  for (const f of findings) {
    html += escHtml(text.slice(last, f.index));
    html += `<mark style="background:${f.color}26;border-bottom:2px solid ${f.color};color:transparent;border-radius:2px;" title="${escHtml(f.label)}">${escHtml(f.match)}</mark>`;
    last = f.end;
  }
  html += escHtml(text.slice(last));
  overlay.innerHTML = html;
}

function clearHighlights(el) {
  if (el._piiOverlay) el._piiOverlay.innerHTML = '';
}

// ── Toast ───────────────────────────────────────────────────────────────────

function showToast(findings) {
  if (toastEl) toastEl.remove();
  const highCount = findings.filter(f => f.severity === 'high').length;
  const msg = highCount > 0
    ? `⚠️ High-risk PII detected — ${findings.length} item(s)`
    : `🔒 PII detected — ${findings.length} item(s)`;
  toastEl = document.createElement('div');
  toastEl.id = 'pii-shield-toast';
  toastEl.innerHTML = `<span>${msg}</span><button id="pii-toast-open">View details</button><button id="pii-toast-dismiss">✕</button>`;
  document.body.appendChild(toastEl);
  document.getElementById('pii-toast-dismiss')?.addEventListener('click', () => toastEl?.remove());
  document.getElementById('pii-toast-open')?.addEventListener('click', () => {
    notifyBg({ type: 'OPEN_SIDE_PANEL' }); // use guarded helper, not raw sendMessage
    toastEl?.remove();
  });
  setTimeout(() => toastEl?.remove(), 8000);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Send a message to the background service worker.
 * Fully guarded against:
 *  - Synchronous throws when the extension context is invalidated (MV3 reload)
 *  - Promise rejections when the SW is sleeping and can't be reached
 *  - "Could not establish connection" errors on first load
 */
function notifyBg(msg) {
  // If the extension has been reloaded/updated, chrome.runtime.id becomes
  // undefined — bail out silently rather than throwing.
  if (!chrome.runtime?.id) return;
  try {
    chrome.runtime.sendMessage(msg).catch(() => {
      // SW was asleep or unavailable — not an error worth surfacing
    });
  } catch (e) {
    // Synchronous throw: extension context invalidated after page load
    // This is safe to ignore — the user can reload the tab to re-activate
  }
}

function handleMessage(msg, _sender, sendResponse) {
  if (!chrome.runtime?.id) return; // guard against invalidated context
  if (msg.type === 'SETTINGS_UPDATED') settings = { ...settings, ...msg.settings };
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function maskPII(value, id) {
  if (id === 'card_number') return value.replace(/\d(?=\d{4})/g, '•');
  if (id === 'email') {
    const [l, d] = value.split('@');
    return l[0] + '•'.repeat(Math.max(0, l.length - 2)) + l.slice(-1) + '@' + d;
  }
  if (value.length > 5) return value.slice(0, 2) + '•'.repeat(value.length - 4) + value.slice(-2);
  return '•'.repeat(value.length);
}

init();

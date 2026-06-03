# PII Shield — Installation & Developer Guide

## Quick Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the folder: `C:\Users\anike\.gemini\antigravity\pii-detector`
5. The extension appears in your toolbar — pin it!

## Testing

1. Go to **chatgpt.com**, **claude.ai**, or any supported AI site
2. Start typing in the chat box with PII such as:
   - `My NI number is AB 12 34 56 C` (UK)
   - `Call me on 07712 345678` (UK)
   - `Or reach me at +1 (555) 123-4567` (US)
   - `Mon numéro est +33 1 23 45 67 89` (France)
   - `My postcode is SW1A 1AA` (UK)
   - `Email me at john.smith@example.com`
3. Within ~300ms you should see:
   - **Amber underline** below the detected text
   - **Toast notification** at the bottom of the page
   - **Red badge** on the extension icon
4. Click **"View details"** in the toast or the extension icon → **"Open Side Panel"**

## Keyboard Shortcut
`Ctrl+Shift+P` — Toggle the side panel from any supported page.

## What's Detected

| Type | Severity | Example |
|------|----------|---------|
| NI Number | 🔴 High | AB 12 34 56 C (UK) |
| NHS Number | 🔴 High | 943 476 5919 (UK) |
| Credit/Debit Card | 🔴 High | 4111 1111 1111 1111 |
| Email | 🟠 Medium | user@example.com |
| Phone Number | 🟠 Medium | +1 (555) 123-4567 / 07712 345678 / +33 1 23 45 67 89 |
| Sort Code | 🟠 Medium | 20-00-00 (UK) |
| Bank Account | 🟠 Medium | 12345678 (UK) |
| Postcode | 🟡 Low | SW1A 1AA (UK) |
| Date of Birth | 🟡 Low | 15/06/1990 |
| Street Address | 🟡 Low | 12 Baker Street |
| Full Name (titled) | 🟡 Low | Mr John Smith |

## Files Overview

```
pii-detector/
├── manifest.json     — Extension config (Manifest v3)
├── background.js     — Service worker: badge, routing, side panel
├── content.js        — Injected into AI sites: monitors typing
├── pii-engine.js     — All detection regex + validation logic
├── content.css       — Toast notification styles
├── popup.html/css/js — Extension popup (toolbar icon click)
├── sidepanel.html/css/js — Detailed findings side panel
├── icons/            — Extension icons (all sizes)
└── _locales/en/      — i18n strings
```

## Publishing to Chrome Web Store

### One-time setup
1. Create a [CWS Developer account](https://chrome.google.com/webstore/devconsole) ($5 fee)
2. Write a privacy policy (required) — template at `yoursite.com/privacy`

### Packaging
```powershell
# Zip the extension folder (exclude any dev files)
Compress-Archive -Path "C:\Users\anike\.gemini\antigravity\pii-detector\*" `
  -DestinationPath "pii-shield-v1.0.zip"
```

### Submission checklist
- [ ] Extension zipped
- [ ] 3 screenshots (1280×800 or 640×400)
- [ ] Promo tile (440×280)
- [ ] Privacy policy URL
- [ ] Store listing description
- [ ] Category: Productivity
- [ ] Review time: ~3–7 business days

## Monetisation Roadmap

### Phase 3 (after launch validation)
1. Add freemium gate in `pii-engine.js` — limit free tier to email/phone/postcode
2. Add Pro unlock UI in `popup.html`
3. Set up [Lemon Squeezy](https://lemonsqueezy.com) for payments (UK-friendly)
4. Deploy license validator as Cloudflare Worker (free tier handles it)
5. Store license key in `chrome.storage.sync`

**Pricing suggestion**: £2.99/month or £19.99/year

## Next Steps (Phase 2 Features)
- [ ] **Redact button** — replace PII with `[REDACTED]` in-place
- [ ] **Severity filter** — show only high/medium in panel
- [ ] **Session stats** — how many items caught over time
- [ ] **Custom patterns** — user-defined regex allowlist
- [ ] **Clipboard monitor** — alert when PII is pasted
- [ ] **Export report** — download session log as CSV

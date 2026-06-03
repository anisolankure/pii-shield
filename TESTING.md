# PII Shield — Testing Guide

## Unit Tests

### Running Tests in Browser

1. Go to any supported AI site (ChatGPT, Claude, etc.)
2. Open **Developer Console** (`F12` → Console tab)
3. Paste this to load and run tests:
```javascript
const script = document.createElement('script');
script.src = chrome.runtime.getURL('pii-engine.test.js');
document.head.appendChild(script);
```

4. Tests will run and output results to console

### Test Coverage

**37 unit tests** covering:

#### Phone Numbers (17 tests)
- ✅ US: `+1 (555) 123-4567`, `(555) 123-4567`, `555-123-4567`
- ✅ UK: `07712 345678`, `+44 7712 345678`
- ✅ International: `+33`, `+49`, `+61` formats
- ✅ Rejects: version numbers, IPs, repeated digits, bare 8-digit numbers

#### UK-Specific (6 tests)
- NI Numbers, NHS Numbers, Sort Codes, Bank Accounts, Postcodes

#### Generic (8 tests)
- Emails, Credit Cards, Dates, Names, Addresses

#### Comprehensive (1 test)
- All 11 PII types detected in single text block

---

## Manual Testing

### Test Sentence (All 11 Types)
```
My name is Mr John Smith, I live at 12 Baker Street London SW1A 1AA, 
born 15/06/1990, phone +1 (555) 123-4567, email john.smith@example.com, 
NHS 943 476 5919, NI AB 12 34 56 C, sort code 20-00-00, 
account 12345678, card 4111 1111 1111 1111.
```

Expected detections:
- 🔴 High Risk: NI, NHS, Card (3)
- 🟠 Medium Risk: Phone, Email, Sort Code (3)
- 🟡 Low Risk: Name, Address, Postcode, DOB, Account (5)

**Total: 11 items detected**

### Quick Test by Country

**US:**
```
Call me at +1 (555) 123-4567 or (555) 123-4567
```

**UK:**
```
My mobile is 07712 345678 or +44 7712 345678
```

**France:**
```
Mon numéro est +33 1 23 45 67 89
```

**Germany:**
```
Meine Nummer ist +49 30 12345678
```

---

## Regression Testing

Before releasing:

1. **Run unit tests** — ensure all pass
2. **Test comprehensive sentence** — should detect all 11 types
3. **Test edge cases:**
   - Very long input (5000+ chars)
   - Multiple PII items in one line
   - PII with unusual formatting
4. **Test on each supported site:**
   - ChatGPT
   - Claude.ai
   - Gemini
   - Copilot
   - Perplexity

---

## Known Limitations

- **Phone validation**: Rejects numbers <7 or >15 digits (covers 99% of real phones)
- **Postcode**: UK-only (would need international address format support for expansion)
- **Full Name**: Requires title prefix (Mr, Mrs, etc.) to avoid false positives
- **Bank Account**: 8-digit number detection (UK standard, may need adjustment for other countries)

---

## Adding New Tests

To add more tests, edit `pii-engine.test.js`:

```javascript
test('Pattern Name: description', () => {
  assertDetected('sample text with PII', 'pattern_id');
  // or
  assertPhoneDetected('text', true); // for phone numbers
});
```

Then reload extension and re-run tests.

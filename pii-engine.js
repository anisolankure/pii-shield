/**
 * PII Engine — Global PII detection
 * All processing is local. Nothing leaves the browser.
 */

const PII_PATTERNS = [
  // ── HIGH RISK ────────────────────────────────────────────────
  {
    id: 'ni_number',
    label: 'National Insurance Number',
    severity: 'high',
    color: '#ef4444',
    regex: /\b([A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D])\b/gi,
    description: 'UK National Insurance Number'
  },
  {
    id: 'nhs_number',
    label: 'NHS Number',
    severity: 'high',
    color: '#ef4444',
    // 10 digits, often formatted as 3-3-4
    regex: /\b(\d{3}\s\d{3}\s\d{4}|\d{10})\b/g,
    description: 'NHS Number (10 digits)',
    validate: (match) => luhnNHS(match.replace(/\s/g, ''))
  },
  {
    id: 'card_number',
    label: 'Card Number',
    severity: 'high',
    color: '#ef4444',
    regex: /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b/g,
    description: 'Credit/Debit card number',
    validate: (match) => luhnCheck(match.replace(/[\s\-]/g, ''))
  },

  // ── MEDIUM RISK ──────────────────────────────────────────────
  {
    id: 'email',
    label: 'Email Address',
    severity: 'medium',
    color: '#f97316',
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    description: 'Email address'
  },
  {
    id: 'phone',
    label: 'Phone Number',
    severity: 'medium',
    color: '#f97316',
    regex: /(?:\+\d{1,3}\s?)?(?:\([\d\s]+\)|[\d\s\-\.]+)(?:[\s\-.]?[\d\s\-\.])*[\d]/g,
    description: 'Phone number (international or domestic format)',
    validate: (match) => validatePhone(match)
  },
  {
    id: 'sort_code',
    label: 'Sort Code',
    severity: 'medium',
    color: '#f97316',
    regex: /\b(\d{2}[-\s]\d{2}[-\s]\d{2})\b/g,
    description: 'UK bank sort code'
  },
  {
    id: 'account_number',
    label: 'Bank Account Number',
    severity: 'medium',
    color: '#f97316',
    regex: /\b([0-9]{8})\b/g,
    description: 'UK bank account number (8 digits)'
  },

  // ── LOW RISK ─────────────────────────────────────────────────
  {
    id: 'uk_postcode',
    label: 'UK Postcode',
    severity: 'low',
    color: '#eab308',
    regex: /\b(([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2}))\b/gi,
    description: 'UK postcode'
  },
  {
    id: 'date_of_birth',
    label: 'Date of Birth',
    severity: 'low',
    color: '#eab308',
    // UK date format DD/MM/YYYY or DD-MM-YYYY
    regex: /\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](19|20)\d{2}\b/g,
    description: 'Date (potential date of birth)'
  },
  {
    id: 'uk_address',
    label: 'Street Address',
    severity: 'low',
    color: '#eab308',
    regex: /\b\d{1,4}\s+[A-Za-z\s]{3,30}\s*(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Cl|Way|Place|Pl|Court|Ct|Crescent|Cres|Grove|Terrace|Terr|Square|Sq|Hill|Park|Gardens|Gdns)\b/gi,
    description: 'Street address'
  },
  {
    id: 'full_name',
    label: 'Full Name',
    severity: 'low',
    color: '#eab308',
    // Title + two capitalised words — heuristic, some false positives expected
    regex: /\b(Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Rev)\.?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
    description: 'Full name with title'
  }
];

/**
 * Luhn algorithm for card number validation
 */
function luhnCheck(num) {
  if (!/^\d+$/.test(num) || num.length < 13 || num.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

/**
 * NHS number check digit validation
 */
function luhnNHS(num) {
  if (num.length !== 10 || !/^\d+$/.test(num)) return false;
  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  let total = 0;
  for (let i = 0; i < 9; i++) {
    total += parseInt(num[i], 10) * weights[i];
  }
  const remainder = total % 11;
  const checkDigit = 11 - remainder;
  if (checkDigit === 11) return parseInt(num[9], 10) === 0;
  if (checkDigit === 10) return false;
  return parseInt(num[9], 10) === checkDigit;
}

/**
 * Phone number validation — ensures a match is actually a phone number
 * and not random digits or false positives like version numbers
 */
function validatePhone(match) {
  // Extract only digits
  const digits = match.replace(/\D/g, '');

  // Must have 7-15 digits (covers most international formats)
  if (digits.length < 7 || digits.length > 15) return false;

  // Don't match pure sequential digits (e.g., 1234567 or 9999999)
  if (/^(\d)\1{5,}$/.test(digits)) return false;

  // International format check: if starts with +, needs 9+ digits after
  if (match.startsWith('+')) {
    const afterPlus = digits.slice(match.match(/^\+\d+/)[0].replace(/\D/g, '').length);
    if (afterPlus.length < 6) return false;
  }

  // Parentheses should be properly paired
  const openParen = (match.match(/\(/g) || []).length;
  const closeParen = (match.match(/\)/g) || []).length;
  if (openParen !== closeParen) return false;

  return true;
}


/**
 * Scan a string for PII matches.
 * Returns array of { type, label, severity, color, match, index, end }
 */
function scanText(text) {
  const findings = [];

  for (const pattern of PII_PATTERNS) {
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const raw = match[0];
      // Run optional validator
      if (pattern.validate && !pattern.validate(raw)) continue;
      // Avoid pure numbers being flagged as NHS unless they're exactly 10 digits
      if (pattern.id === 'nhs_number') {
        const stripped = raw.replace(/\s/g, '');
        if (stripped.length !== 10) continue;
        if (!luhnNHS(stripped)) continue;
      }
      findings.push({
        patternId: pattern.id,
        label: pattern.label,
        severity: pattern.severity,
        color: pattern.color,
        match: raw,
        index: match.index,
        end: match.index + raw.length,
        description: pattern.description
      });
    }
  }

  // De-duplicate overlapping matches — keep highest severity
  return deduplicateFindings(findings);
}

/**
 * Remove overlapping findings, keeping the highest-severity one
 */
function deduplicateFindings(findings) {
  const severityRank = { high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => a.index - b.index);
  const result = [];
  let lastEnd = -1;

  for (const f of findings) {
    if (f.index < lastEnd) {
      // Overlaps — compare severity
      const prev = result[result.length - 1];
      if (severityRank[f.severity] > severityRank[prev.severity]) {
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

// Export for content.js (loaded as separate script, not module — use global)
window.PIIEngine = { scanText, PII_PATTERNS };

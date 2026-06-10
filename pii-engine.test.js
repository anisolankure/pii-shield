/**
 * PII Engine — Unit Tests
 * Run in browser console or Node.js environment with pii-engine.js loaded
 */

const TEST_RESULTS = [];

function test(name, fn) {
  try {
    fn();
    TEST_RESULTS.push({ name, status: '✅ PASS', error: null });
  } catch (e) {
    TEST_RESULTS.push({ name, status: '❌ FAIL', error: e.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertPhoneDetected(text, shouldFind) {
  const findings = window.PIIEngine.scanText(text);
  const found = findings.some(f => f.patternId === 'phone');
  assert(found === shouldFind, `Expected phone${shouldFind ? '' : ' NOT'} found in: "${text}"`);
}

function assertNotDetected(text, patternId) {
  const findings = window.PIIEngine.scanText(text);
  const found = findings.some(f => f.patternId === patternId);
  assert(!found, `Expected no ${patternId} in: "${text}"`);
}

function assertDetected(text, patternId) {
  const findings = window.PIIEngine.scanText(text);
  const found = findings.some(f => f.patternId === patternId);
  assert(found, `Expected ${patternId} in: "${text}"`);
}

// ─────────────────────────────────────────────────────────────────────
// PHONE NUMBER TESTS
// ─────────────────────────────────────────────────────────────────────

test('Phone: US international format', () => {
  assertPhoneDetected('+1 (555) 123-4567', true);
});

test('Phone: US domestic with parentheses', () => {
  assertPhoneDetected('(555) 123-4567', true);
});

test('Phone: US domestic with dashes', () => {
  assertPhoneDetected('555-123-4567', true);
});

test('Phone: UK mobile', () => {
  assertPhoneDetected('07712 345678', true);
});

test('Phone: UK with +44', () => {
  assertPhoneDetected('+44 7712 345678', true);
});

test('Phone: France +33', () => {
  assertPhoneDetected('+33 1 23 45 67 89', true);
});

test('Phone: Germany +49', () => {
  assertPhoneDetected('+49 30 12345678', true);
});

test('Phone: Australia +61', () => {
  assertPhoneDetected('+61 2 1234 5678', true);
});

test('Phone: Canada +1', () => {
  assertPhoneDetected('+1 604 555 1234', true);
});

test('Phone rejects: Version number', () => {
  assertPhoneDetected('version 1.2.3.4', false);
});

test('Phone rejects: Repeated digits', () => {
  assertPhoneDetected('1111111', false);
});

test('Phone rejects: IP address', () => {
  assertPhoneDetected('192.168.1.1', false);
});

test('Phone rejects: Too short (5 digits)', () => {
  assertPhoneDetected('12345', false);
});

test('Phone rejects: Too long (20 digits)', () => {
  assertPhoneDetected('12345678901234567890', false);
});

test('Phone rejects: Unbalanced parentheses', () => {
  assertPhoneDetected('(555) 123-4567 extra)', false);
});

test('Phone rejects: Sequential digits', () => {
  assertPhoneDetected('1234567', false);
});

// ─────────────────────────────────────────────────────────────────────
// EMAIL TESTS
// ─────────────────────────────────────────────────────────────────────

test('Email: standard format', () => {
  assertDetected('user@example.com', 'email');
});

test('Email: with subdomain', () => {
  assertDetected('john.smith@mail.example.co.uk', 'email');
});

test('Email: with plus addressing', () => {
  assertDetected('user+tag@example.com', 'email');
});

// ─────────────────────────────────────────────────────────────────────
// CARD NUMBER TESTS
// ─────────────────────────────────────────────────────────────────────

test('Card: Visa format', () => {
  assertDetected('4111 1111 1111 1111', 'card_number');
});

test('Card: Mastercard format', () => {
  assertDetected('5500 0000 0000 0004', 'card_number');
});

test('Card: without spaces', () => {
  assertDetected('4111111111111111', 'card_number');
});

// ─────────────────────────────────────────────────────────────────────
// UK-SPECIFIC TESTS
// ─────────────────────────────────────────────────────────────────────

test('NI Number: valid format', () => {
  assertDetected('AB 12 34 56 C', 'ni_number');
});

test('NHS Number: 10 digits', () => {
  assertDetected('943 476 5919', 'nhs_number');
});

test('NHS Number: without spaces', () => {
  assertDetected('9434765919', 'nhs_number');
});

test('Sort Code: standard format', () => {
  assertDetected('20-00-00', 'sort_code');
});

test('Sort Code: with spaces', () => {
  assertDetected('20 00 00', 'sort_code');
});

test('Bank Account: 8 digits', () => {
  assertDetected('12345678', 'account_number');
});

test('Postcode: valid UK format', () => {
  assertDetected('SW1A 1AA', 'uk_postcode');
});

test('Postcode: without space', () => {
  assertDetected('SW1A1AA', 'uk_postcode');
});

// ─────────────────────────────────────────────────────────────────────
// GENERIC TESTS
// ─────────────────────────────────────────────────────────────────────

test('Date of Birth: DD/MM/YYYY', () => {
  assertDetected('15/06/1990', 'date_of_birth');
});

test('Date of Birth: DD-MM-YYYY', () => {
  assertDetected('15-06-1990', 'date_of_birth');
});

test('Full Name: with title', () => {
  assertDetected('Mr John Smith', 'full_name');
});

test('Full Name: Mrs variant', () => {
  assertDetected('Mrs Jane Doe', 'full_name');
});

test('Street Address: UK format', () => {
  assertDetected('12 Baker Street', 'uk_address');
});

test('Street Address: with Ave', () => {
  assertDetected('100 Oxford Avenue', 'uk_address');
});

// ─────────────────────────────────────────────────────────────────────
// INTERNATIONAL PATTERNS (v1.0.6)
// ─────────────────────────────────────────────────────────────────────

test('US SSN: standard format', () => {
  assertDetected('123-45-6789', 'us_ssn');
});

test('US SSN: with spaces', () => {
  assertDetected('123 45 6789', 'us_ssn');
});

test('US SSN: without separators', () => {
  assertDetected('123456789', 'us_ssn');
});

test('US SSN rejects: Area code 000', () => {
  assertNotDetected('000-12-3456', 'us_ssn');
});

test('US SSN rejects: Area code 666', () => {
  assertNotDetected('666-12-3456', 'us_ssn');
});

test('US SSN rejects: Area code 900+', () => {
  assertNotDetected('999-12-3456', 'us_ssn');
});

test('US Driver License: CA format', () => {
  assertDetected('CA1234567', 'us_drivers_license');
});

test('US Driver License: NY format', () => {
  assertDetected('NY123456', 'us_drivers_license');
});

test('Australian TFN: standard format', () => {
  assertDetected('123 456 789', 'au_tfn');
});

test('Australian TFN: with dashes', () => {
  assertDetected('123-456-789', 'au_tfn');
});

test('Australian TFN: no separators', () => {
  assertDetected('12345678901', 'au_tfn');
});

test('Australian TFN: with different separators', () => {
  assertDetected('123-456-789-01', 'au_tfn');
});

test('Canadian SIN: standard format', () => {
  assertDetected('123-456-789', 'ca_sin');
});

test('Canadian SIN: with spaces', () => {
  assertDetected('123 456 789', 'ca_sin');
});

test('Canadian SIN: no separators', () => {
  assertDetected('123456789', 'ca_sin');
});

test('Canadian SIN rejects: First digit 0', () => {
  assertNotDetected('023-456-789', 'ca_sin');
});

test('German Tax ID: standard format', () => {
  assertDetected('12 345 678 901', 'de_tax_id');
});

test('German Tax ID: without spaces', () => {
  assertDetected('12345678901', 'de_tax_id');
});

test('French SIRET: standard format', () => {
  assertDetected('123 456 789 12345', 'fr_siret');
});

test('French SIRET: with dashes', () => {
  assertDetected('123-456-789-12345', 'fr_siret');
});

test('French SIREN: standard format', () => {
  assertDetected('123 456 789', 'fr_siret');
});

// ─────────────────────────────────────────────────────────────────────
// COMPREHENSIVE TEST
// ─────────────────────────────────────────────────────────────────────

test('All 11 PII types detected in single text', () => {
  const text = 'My name is Mr John Smith, I live at 12 Baker Street London SW1A 1AA, born 15/06/1990, phone +1 (555) 123-4567, email john.smith@example.com, NHS 943 476 5919, NI AB 12 34 56 C, sort code 20-00-00, account 12345678, card 4111 1111 1111 1111.';
  const findings = window.PIIEngine.scanText(text);

  const expectedPatterns = [
    'full_name',
    'uk_address',
    'uk_postcode',
    'date_of_birth',
    'phone',
    'email',
    'nhs_number',
    'ni_number',
    'sort_code',
    'account_number',
    'card_number'
  ];

  expectedPatterns.forEach(patternId => {
    const found = findings.some(f => f.patternId === patternId);
    assert(found, `Missing ${patternId}`);
  });
});

// ─────────────────────────────────────────────────────────────────────
// REPORT RESULTS
// ─────────────────────────────────────────────────────────────────────

function reportResults() {
  console.log('\n' + '='.repeat(60));
  console.log('PII ENGINE TEST RESULTS');
  console.log('='.repeat(60));

  const passed = TEST_RESULTS.filter(r => r.status === '✅ PASS').length;
  const failed = TEST_RESULTS.filter(r => r.status === '❌ FAIL').length;

  TEST_RESULTS.forEach(r => {
    console.log(`${r.status} ${r.name}`);
    if (r.error) console.log(`   → ${r.error}`);
  });

  console.log('='.repeat(60));
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${TEST_RESULTS.length}`);
  console.log('='.repeat(60) + '\n');

  return failed === 0;
}

// Run tests automatically if in browser
if (typeof window !== 'undefined' && window.PIIEngine) {
  reportResults();
}

// Export for Node.js
if (typeof module !== 'undefined') {
  module.exports = { test, reportResults };
}

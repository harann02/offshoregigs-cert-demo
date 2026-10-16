// Unit tests for namecheck.js (FAKE names only). Run: node tools/test_namecheck.js
const assert = require('assert');
const N = require('../namecheck.js');
let n = 0; const t = (a, b, want) => { const r = N.compare(a, b); assert.strictEqual(r.result, want, `${a} vs ${b}: got ${r.result} (score ${r.score})`); n++; console.log('ok -', a, '|', b, '=>', want); };
t('AHMAD BIN ALI', 'Ahmad Ali', 'match');
t('AHMAD B1N ALI', 'Ahmad Ali', 'match');           // OCR typo in connector
t('AHNAD BIN ALI', 'Ahmad Ali', 'match');           // OCR typo in name word
t('SITI NURHALIZA BINTI TARUDIN', 'Siti Tarudin', 'match'); // missing middle name
t('NUR AISYAH BT. ISMAIL', 'Nur Aisyah Ismail', 'match');
t('ENCIK AHMAD BIN ALI', 'ahmad ali', 'match');
t('MUTHU A/L RAMASAMY', 'Muthu Ramasamy', 'match');
t('MUTHU A / L RAMASAMY', 'Muthu Ramasamy', 'match');
t('PRIYA A/P SUBRAMANIAM', 'Priya Subramaniam', 'match');
t('RAJ S/O KUMAR', 'Raj Kumar', 'match');
t('M. RAMASAMY', 'Muthu Ramasamy', 'match');        // initial
t('TAN AH KOW', 'Tan Ah Kow', 'match');
t('KOW AH TAN', 'Tan Ah Kow', 'match');             // order difference
t('MR. TAN AH K0W', 'tan ah kow', 'match');
t('AHMAD DEMO SAMPLE', 'AHMAD DEMO SAMPLE', 'match');
t('AHMAD DEMO SAMPLE', 'Ahmad Ali', 'partial');
t('AHMAD BIN ABU', 'Ahmad Ali', 'partial');
t('AHMAD', 'Ahmad Ali', 'partial');
t('LIM WEI JIE', 'Ahmad Ali', 'mismatch');
t('MUTHU A/L RAMASAMY', 'Tan Ah Kow', 'mismatch');
t('', 'Ahmad Ali', 'not_found');
t(null, 'Ahmad Ali', 'not_found');
assert.deepStrictEqual(N.THRESHOLDS, { TOKEN_OK: 0.85, MATCH_AVG: 0.9 });
console.log(n + ' tests passed');

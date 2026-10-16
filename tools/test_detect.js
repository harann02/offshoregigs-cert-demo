// Unit tests for detect.js + category matching (FAKE data only). Run: node tools/test_detect.js
global.window = {};
const assert = require('assert');
const D = require('../detect.js');
const store = {}; global.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
require('../categories.js');
const CATS = window.OGCategories.BASE;
const today = new Date(2026, 9, 16);
const run = (text, cats = CATS) => D.summarise(D.detect(text, [text]), 'x', { text, categories: cats, today });
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

const GTSC = `DEMO SAFETY
Presents This Certificate
To
AHMAD DEMO SAMPLE
Who has completed a three day(s) course
in
TROPICAL BASIC OFFSHORE SAFETY INDUCTION &
EMERGENCY TRAINING
(Course Code:5501)
Certificate No. :DEMO55010000000000123
Date of Issue :16 Sep 2015
Date of Expiry :15 Sep 2019
Authorized Signatory
www.demo-safety.example`;

t('GTSC-style layout: long course name, Presents...To, D Mon YYYY, colon labels, expired', () => {
  const r = run(GTSC);
  assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.type, 'BOSIET');
  assert.strictEqual(r.category, '5501 - T BOSIET');
  assert.strictEqual(r.name, 'AHMAD DEMO SAMPLE');
  assert.strictEqual(r.certificate_number, 'DEMO55010000000000123');
  assert.strictEqual(r.issue_date, '16/09/2015'); assert.strictEqual(r.expiry_date, '15/09/2019');
  assert.strictEqual(r.expired, true); assert.strictEqual(r.can_confirm, true);
  assert.strictEqual(r.provider, 'demo-safety.example');
});
t('script-font OCR noise ("Yo" for To, "lssue", "Exp1ry", no course code)', () => {
  const txt = GTSC.replace('To\n', 'Yo\n').replace('Date of Issue', 'Date of lssue').replace('Expiry', 'Exp1ry').replace('(Course Code:5501)\n', '');
  const r = run(txt);
  assert.strictEqual(r.name, 'AHMAD DEMO SAMPLE'); assert.strictEqual(r.issue_date, '16/09/2015');
  assert.strictEqual(r.expiry_date, '15/09/2019'); assert.strictEqual(r.category, '5501 - T BOSIET');
});
t('name from "Presents This Certificate To NAME" on one line', () => {
  assert.strictEqual(run('Presents This Certificate To AHMAD DEMO SAMPLE\nBOSIET\nDate of Expiry : 1 Jan 2030').name, 'AHMAD DEMO SAMPLE');
});
t('Tropical BOSIET with CA-EBS and TSBB -> 5509 by variant (course code not in list)', () => {
  const r = run(`This is to certify\nAHMAD DEMO SAMPLE\nhas been assessed against and met the learning outcomes for\nTropical BOSIET with CA-EBS and Travel Safely\nBy Boat\nOpito Course Code : 0000\nCovers HUET with Compressed Air Emergency Breathing System (CA-EBS)\nThis certificate is valid till : 11 MARCH 2029\nCertificate No : 000000DEMO000123`);
  assert.strictEqual(r.category, '5509 - T BOSIET WITH CAEBS & TSBB'); assert.strictEqual(r.expired, false);
  assert.strictEqual(r.detected_title, 'Tropical BOSIET with CA-EBS and Travel Safely By Boat');
});
t('BOSIET with EBS (5700)', () => assert.strictEqual(run('BOSIET\nBasic Offshore Safety Induction and Emergency Training with EBS\nName: A B').category, '5700 - BOSIET WITH EBS'));
t('word match for non-OPITO list entries', () => assert.strictEqual(run('Certificate of Completion\nThis is to certify\nAHMAD DEMO\nhas successfully completed\nBasic H2S Awareness').category, 'BASIC H2S'));
const IRATA = `Certificate of Competence\nThis is to certify\nSITI DEMO EXAMPLE\nhas successfully completed\nIRATA Rope Access Technician Level 1\nCertificate No: DEMO-IRT-000789\nExpiry Date: 05/05/2028`;
t('certificate not in list -> not_listed with detected title', () => {
  const r = run(IRATA);
  assert.strictEqual(r.status, 'not_listed'); assert.strictEqual(r.can_confirm, false);
  assert.strictEqual(r.detected_title, 'IRATA Rope Access Technician Level 1');
});
t('admin-approved category matches future uploads', () => {
  const O = window.OGCategories; const q = O.request('IRATA Rope Access Technician Level 1', 'irata.pdf');
  assert.strictEqual(q.status, 'Pending'); O.decide(q.id, true);
  assert.strictEqual(run(IRATA, O.all()).category, 'IRATA Rope Access Technician Level 1');
});
t('shopping list stays unknown', () => assert.strictEqual(run('Shopping list\nBread, milk, eggs').status, 'unknown'));
t('HUET-only (not in list) -> not_listed', () => assert.strictEqual(run('Certificate\nHelicopter Underwater Escape Training (HUET)\nName: A B').status, 'not_listed'));
console.log(n + ' tests passed');

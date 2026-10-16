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
t('BOSIET with EBS (5700)', () => assert.strictEqual(run('BOSIET\nBasic Offshore Safety Induction and Emergency Training with EBS\nName: A B\nCertificate No: DEMO-1\nExpiry Date: 01/01/2030').category, '5700 - BOSIET WITH EBS'));
t('word match for non-OPITO list entries', () => assert.strictEqual(run('Certificate of Completion\nThis is to certify\nAHMAD DEMO\nhas successfully completed\nBasic H2S Awareness\nCertificate No: DEMO-H2S-1').category, 'BASIC H2S'));
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

// ---- multi-page grouping ----
const runPages = (pages, cats = CATS) => { const f = D.detectPages(pages); return Object.assign(D.summarise(f, 'x', { text: pages.join('\n'), categories: cats, today }), { f }); };
const B1 = `BOSIET\nBasic Offshore Safety Induction and Emergency Training with EBS\nOPITO Course Code: 5700\nCertificate of Completion\nName: AHMAD DEMO SAMPLE\nCertificate No: DEMO-BOS-000123\nDate of Issue: 12/03/2025\nExpiry Date: 12/03/2029`;
t('duplicate pages (same cert number) -> one certificate, not multiple', () => {
  const r = runPages([B1, B1.replace('Certificate of Completion', 'Certificate of Completlon')]);
  assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.category, '5700 - BOSIET WITH EBS');
  assert.strictEqual(r.certificate_number, 'DEMO-BOS-000123'); assert.deepStrictEqual(r.f.page_groups, [[1, 2]]);
});
t('duplicate with OCR misses on one copy: fields merged from both pages', () => {
  const poor = B1.replace(/Expiry Date: .*/, 'Exp1ry D@te').replace(/Name: .*/, 'Narne');
  const r = runPages([poor, B1.replace(/Date of Issue: .*/, '')]);
  assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.name, 'AHMAD DEMO SAMPLE');
  assert.strictEqual(r.issue_date, '12/03/2025'); assert.strictEqual(r.expiry_date, '12/03/2029');
});
t('duplicate with slightly misread name and number still one certificate', () => {
  const r = runPages([B1, B1.replace('AHMAD DEMO SAMPLE', 'AHMAD DEM0 SAMPLE').replace('000123', '0001Z3')]);
  assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.name, 'AHMAD DEMO SAMPLE');
});
const CARD = `WORKING\nAT HEIGHT\nCOMPETENCY\nAHMAD DEMO SAMPLE\n000000-00-0000\nVENUE AT:\nDEMO TRAINING CENTRE SDN BHD\nTRAINING DATE:\n23 JANUARY 2025\nEXPIRED DATE:\n23 JANUARY 2028`;
const WAH = `Certification of Competency\nThis is to certify that\nAHMAD DEMO SAMPLE\n000000-00-0000\nHas Successfully Certified\nWORKING AT HEIGHT COMPETENCY\nTRAINING & ASSESSMENT\nHeld On\n23rd JANUARY 2025\nAt\nDEMO TRAINING CENTRE SDN BHD\nS/N: WAH 23-01-2025-9\nEXPIRED DATE: 23rd JANUARY 2028`;
t('front/back (card + certificate) -> one Working at Height certificate with all fields', () => {
  const r = runPages([CARD, WAH]);
  assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.category, 'WORKING AT HEIGHT (WAH) BASIC');
  assert.strictEqual(r.name, 'AHMAD DEMO SAMPLE'); assert.strictEqual(r.certificate_number, 'WAH 23-01-2025-9');
  assert.strictEqual(r.issue_date, '23/01/2025'); assert.strictEqual(r.expiry_date, '23/01/2028');
  assert.strictEqual(r.detected_title, 'WORKING AT HEIGHT COMPETENCY TRAINING & ASSESSMENT');
});
t('front/back where the back has no name or number (terms page) -> one certificate', () => {
  assert.strictEqual(runPages([B1, 'Terms and conditions\nThis card remains the property of the training centre.']).status, 'ok');
});
t('WAH LEVEL 2 still needs "level 2"', () => assert.strictEqual(runPages([WAH.replace('COMPETENCY\nTRAINING', 'LEVEL 2 TRAINING')]).category, 'WORKING AT HEIGHT (WAH) LEVEL 2'));
t('two different certificates of the same type (different numbers + names) -> multiple', () => {
  const r = runPages([B1, B1.replace('AHMAD DEMO SAMPLE', 'SITI DEMO EXAMPLE').replace('DEMO-BOS-000123', 'DEMO-BOS-999888')]);
  assert.strictEqual(r.status, 'multiple'); assert.ok(r.multiple_reasons.some((x) => /different certificate numbers/.test(x)));
});
t('different types on each page -> multiple', () => {
  const MED = 'Offshore Medical\nCertificate of Fitness\nName: SITI DEMO EXAMPLE\nCertificate No: DEMO-MED-000456\nFit for offshore work';
  assert.strictEqual(runPages([B1, MED]).status, 'multiple');
});
t('same name, different numbers (two certificates of one person) -> multiple', () => {
  assert.strictEqual(runPages([B1, B1.replace('DEMO-BOS-000123', 'DEMO-BOS-777000').replace('12/03/2025', '01/01/2021')]).status, 'multiple');
});
t('same type+name+both dates but number badly misread -> one certificate', () => {
  assert.strictEqual(runPages([B1, B1.replace('DEMO-BOS-000123', 'XQ7-88')]).status, 'ok');
});
const fs = require('fs');
const QUOTE = fs.readFileSync(__dirname + '/../samples/sample-quotation-FAKE.txt', 'utf8');
t('quotation mentioning "first aid", "training", "certificate" -> unknown, not a certificate, no Confirm', () => {
  const r = run(QUOTE);
  assert.strictEqual(r.status, 'unknown'); assert.strictEqual(r.can_confirm, false);
  assert.strictEqual(r.category, null); assert.strictEqual(r.not_certificate, true); assert.ok(D.quotationScore(QUOTE) >= 2);
});
t('stray words scattered over a document do not match a category', () => {
  assert.strictEqual(D.matchCategory('Training certificate\nItems: gloves, first aid kit, helmet and other very long list of basic site consumables supplied', null, CATS), null);
});
t('hard rule: real title but fewer than 2 core fields -> no Confirm', () => {
  const r = run('Certificate of Completion\nThis is to certify\nAHMAD DEMO\nhas successfully completed\nBasic First Aid');
  assert.strictEqual(r.status, 'unknown'); assert.strictEqual(r.can_confirm, false);
});
t('real Basic First Aid certificate with fields still matches', () => {
  const r = run('Certificate of Completion\nThis is to certify\nAHMAD DEMO\nhas successfully completed\nBasic First Aid\nCertificate No: DEMO-FA-001\nExpiry Date: 01/01/2029');
  assert.strictEqual(r.category, 'BASIC FIRST AID'); assert.strictEqual(r.can_confirm, true);
});
console.log(n + ' tests passed');

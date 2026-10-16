/* Certificate type detection + field extraction.
 * Faithful JavaScript port of detector/detect.py and the name logic in
 * detector/fields.py from the OffshoreGigs demo. Keyword/regex only. */
(function (root) {
  'use strict';
  const TYPES = ['BOSIET', 'FOET', 'HUET', 'Medical', 'OGUK/OEUK', 'CA-EBS'];
  const UNKNOWN = 'Unknown';
  const CONFIDENCE_THRESHOLD = 0.55;

  const SIGNALS = {
    'BOSIET': [
      [String.raw`\b(?:t\s*)?bos[il1]et\b`, 6],
      [String.raw`basicoffshoresafetyinduction(?:and)?emergencytraining`, 7],
      [String.raw`\btropical bos[il1]et\b`, 2],
    ],
    'FOET': [
      [String.raw`\b(?:t\s*)?foet\b`, 6],
      [String.raw`furtheroffshoreemergencytraining`, 7],
    ],
    'HUET': [
      [String.raw`\bhuet\b`, 6],
      [String.raw`helicopterunderwaterescapetraining`, 7],
      [String.raw`helicopterunderwaterescape`, 3],
    ],
    'CA-EBS': [
      [String.raw`\bca\s*ebs\b`, 5],
      [String.raw`compressedairemergencybreathingsystem`, 6],
      [String.raw`\bebs\b`, 1],
      [String.raw`emergencybreathingsystem`, 2],
    ],
    'Medical': [
      [String.raw`\bmedical\b`, 2],
      [String.raw`fitnesstowork`, 4],
      [String.raw`fit(?:for|to)(?:offshore)?work`, 4],
      [String.raw`medicalfitness`, 4],
      [String.raw`offshoremedical`, 4],
      [String.raw`(?:oguk|oeuk|ukooa)medical`, 5],
      [String.raw`medicalexamin`, 3],
      [String.raw`(?:approved|examining)(?:medical)?(?:doctor|examiner|physician)`, 3],
      [String.raw`\b(?:fit|unfit) for (?:offshore )?(?:work|duty|duties)\b`, 3],
      [String.raw`certificateoffitness`, 4],
      [String.raw`chestxray|audiometry|spirometry|visualacuity`, 2],
    ],
    'OGUK/OEUK': [
      [String.raw`\boguk\b|\boeuk\b`, 5],
      [String.raw`oilandgasuk|offshoreenergiesuk`, 5],
      [String.raw`minimumindustrysafetytraining|\bmist\b`, 3],
      [String.raw`\bukooa\b`, 2],
    ],
  };
  const MODULE_OF = { 'HUET': ['BOSIET', 'FOET'], 'CA-EBS': ['BOSIET', 'FOET'] };
  const MONTHS = {}; ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].forEach((m, i) => { MONTHS[m] = i + 1; });

  const DATE = String.raw`(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s*[A-Za-z]{3,9}\.?,?\s*\d{4}|[A-Za-z]{3,9}\.?\s*\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{4})`;
  const ISSUE_LABEL = String.raw`(?:date\s*of\s*(?:issue|award|completion|examination|medical|assessment|training)|issue[d]?\s*(?:date|on)?|awarded(?:\s*on)?|completion\s*date|date\s*completed|course\s*date|examination\s*date|date\s*of\s*course|tarikh\s*dikeluarkan)`;
  const EXPIRY_LABEL = String.raw`(?:date\s*of\s*expiry|expiry(?:\s*date)?|expiration(?:\s*date)?|expires(?:\s*on)?|valid\s*(?:until|till|to|through)|fit\s*until|next\s*(?:medical|examination)\s*due|sah\s*sehingga|tarikh\s*luput)`;
  const CERT_LABEL = String.raw`(?:certificate|certification|cert)\s*(?:no\.?|number|#|ref(?:erence)?)|serial\s*(?:no\.?|number)|reference\s*(?:no\.?|number)|ref\.?\s*no\.?|opito\s*(?:certification|learner|delegate)?\s*(?:no\.?|number|id)`;
  const PROVIDER_LABEL = String.raw`(?:training\s*(?:provider|centre|center|organisation|organization)|provider|issued\s*by|centre|center|medical\s*(?:centre|center|clinic)|clinic)`;
  const DOCTOR_LABEL = String.raw`(?:examining\s*(?:doctor|physician)|approved\s*(?:doctor|examiner)|medical\s*examiner)`;
  const PROVIDER_WORDS = String.raw`\b(?:training|centre|center|academy|institute|survival|sdn\.?\s*bhd|bhd|ltd|limited|llc|clinic|hospital|medical\s+services|safety\s+services|college|school)\b`;

  // checker.normalized: NFKC, casefold, keep runs of letters/digits, single spaces.
  function normalized(value) {
    const words = String(value || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}\p{M}]+/gu);
    return words ? words.join(' ') : '';
  }
  const compact = (text) => normalized(text).replace(/ /g, '');
  const count = (pattern, text, flags = '') => (text.match(new RegExp(pattern, 'g' + flags)) || []).length;

  function scoreText(text) {
    const plain = ' ' + normalized(text) + ' ';
    const joined = compact(text);
    const scores = {}, evidence = {};
    for (const [kind, rules] of Object.entries(SIGNALS)) {
      let total = 0;
      for (const [pattern, weight] of rules) {
        const hits = count(pattern, plain) || count(pattern, joined);
        if (hits) { total += weight * Math.min(hits, 3); (evidence[kind] = evidence[kind] || []).push(pattern); }
      }
      scores[kind] = total;
    }
    for (const [module, parents] of Object.entries(MODULE_OF)) {
      if (parents.some((p) => scores[p] >= 6)) scores[module] = Math.floor(scores[module] / 3);
    }
    if (scores['Medical'] >= 6) scores['OGUK/OEUK'] = Math.floor(scores['OGUK/OEUK'] / 3);
    return [scores, evidence];
  }

  const rank = (scores) => Object.entries(scores).sort((a, b) => (b[1] - a[1]) || (TYPES.indexOf(a[0]) - TYPES.indexOf(b[0])));

  function confidenceFrom(scores) {
    const ranked = rank(scores);
    const [topKind, top] = ranked[0];
    const second = ranked.length > 1 ? ranked[1][1] : 0;
    if (top <= 0) return [UNKNOWN, 0.0];
    const strength = Math.min(1.0, top / 8);
    const margin = (top - second) / top;
    return [topKind, Math.round(Math.max(0.0, Math.min(0.99, strength * (0.4 + 0.6 * margin))) * 100) / 100];
  }

  const year = (v) => { v = parseInt(v, 10); return v < 100 ? v + 2000 : v; };
  // Like datetime.date(): returns null (ValueError) for impossible dates.
  function mkDate(y, m, d) {
    if (!(y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1)) return null;
    const dt = new Date(Date.UTC(2000, m - 1, d)); dt.setUTCFullYear(y);
    return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
  }
  const isDigit = (s) => /^\d+$/.test(s);

  function parseDate(raw) {
    raw = raw.trim().replace(/[.,]+$/, '');
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      return [mkDate(y, m, d), false];
    }
    const numeric = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})$/.exec(raw);
    if (numeric) {
      const a = +numeric[1], b = +numeric[2], y = year(numeric[3]);
      if ((a > 12 && 12 >= b) || a === b || (a <= 12 && b <= 12)) {
        const d = mkDate(y, b, a);
        return d ? [d, a <= 12 && b <= 12 && a !== b] : [null, false];
      }
      if (b > 12 && 12 >= a) return [mkDate(y, a, b), false];
      return [null, false];
    }
    let cleaned = raw.replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    cleaned = cleaned.replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2');
    const words = cleaned.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 3) {
      let day, month, yr;
      if (isDigit(words[0])) [day, month, yr] = words; else [month, day, yr] = words;
      const mn = MONTHS[month.slice(0, 3).toLowerCase()];
      if (mn && isDigit(day) && isDigit(yr)) return [mkDate(+yr, mn, +day), false];
    }
    return [null, false];
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dayFirst = (d) => d ? `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).padStart(4, '0')}` : null;

  function labelledValues(lines, label, valuePattern, lookahead = 2, anchored = false) {
    const found = [];
    const prefix = anchored ? String.raw`^\s*` : String.raw`\b`;
    const re = new RegExp(prefix + '(?:' + label + String.raw`)\s*[:#\-]?\s*`, 'gi');
    const valueRe = new RegExp(String.raw`^\s*` + valuePattern, 'i');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(re)) {
        const candidates = [line.slice(match.index + match[0].length)].concat(lines.slice(index + 1, index + 1 + lookahead));
        for (let position = 0; position < candidates.length; position++) {
          const value = valueRe.exec(candidates[position]);
          if (value) { found.push([value[1].trim(), line]); break; }
          if (position && candidates[position].trim()) break;
        }
      }
    });
    return found;
  }

  function dateField(lines, label) {
    const values = labelledValues(lines, label, DATE);
    const parsed = []; let assumed = false;
    for (const [raw] of values) {
      const [d, guess] = parseDate(raw);
      if (d) { parsed.push(d); assumed = assumed || guess; }
    }
    const distinct = [...new Set(parsed.map((d) => d.getTime()))].sort((a, b) => a - b);
    if (distinct.length === 1) return [new Date(distinct[0]), assumed, values.length];
    return [null, false, distinct.length];
  }

  function certificateNumber(lines) {
    const values = labelledValues(lines, CERT_LABEL, String.raw`([A-Za-z0-9][A-Za-z0-9/_.-]{2,40}(?:\s?[A-Za-z0-9/_.-]{2,20})?)`)
      .filter(([v]) => /\d/.test(v));
    return [...new Set(values.map(([v]) => v.trim()))];
  }

  function provider(lines, person) {
    for (const group of [PROVIDER_LABEL, DOCTOR_LABEL]) {
      const re = new RegExp(String.raw`^\s*` + group + String.raw`\s*[:\-]\s*(.*)$`, 'i');
      for (let i = 0; i < lines.length; i++) {
        const m = re.exec(lines[i]);
        if (m) {
          const value = m[1].trim() || (i + 1 < lines.length ? lines[i + 1].trim() : '');
          if (value && !/\d{4}/.test(value)) return value.slice(0, 120);
        }
      }
    }
    const pool = lines.slice(0, 12).concat(lines.slice(-8));
    for (const line of pool) {
      if (line.length <= 90 && new RegExp(PROVIDER_WORDS, 'i').test(line) && line !== person &&
          !/certif|has\s+(?:successfully\s+)?completed|this\s+is|emergency\s+training|induction|course|:/i.test(line)) return line.trim();
    }
    return null;
  }

  function countCertificates(text, lines) {
    const reasons = [];
    const headers = Math.max(...[
      String.raw`this\s+is\s+to\s+certify|hereby\s+certif`,
      String.raw`certificate\s+of\s+(?:completion|achievement|attendance|competence|fitness)`].map((p) => count(p, text, 'i')));
    if (headers > 1) reasons.push(`${headers} certificate headings found`);
    const numbers = certificateNumber(lines);
    if (numbers.length > 1) reasons.push(`${numbers.length} different certificate numbers found`);
    const names = new Set(labelledValues(lines, String.raw`(?:full\s*name|candidate(?:\s*name)?|delegate(?:\s*name)?|participant(?:\s*name)?|name|nama)`,
      String.raw`([A-Za-z][A-Za-z .'@-]{2,80})`, 1, true).map(([v]) => normalized(v)));
    if (names.size > 1) reasons.push('different names found');
    return reasons;
  }

  // ---- fields.py (name extraction) ----
  const field = (value = null, evidence = null, note = 'Read from the document. Please confirm.') =>
    ({ value, evidence: evidence || [], note: value ? note : 'Not found reliably. Check the original document.' });

  const stripChars = (s, chars) => { let a = 0, b = s.length; while (a < b && chars.includes(s[a])) a++; while (b > a && chars.includes(s[b - 1])) b--; return s.slice(a, b); };

  function labelled(lines, pattern, validator, limit = 4) {
    const found = [];
    const re = new RegExp(pattern, 'i');
    lines.forEach((line, index) => {
      const match = re.exec(line);
      if (!match || match.index !== 0) return;
      const value = stripChars(line.slice(match[0].length), ' :-');
      const candidates = value ? [value] : lines.slice(index + 1, index + 1 + limit);
      for (const c of candidates) {
        if (validator(c)) { found.push([c, line + (c !== value ? '\n' + c : '')]); break; }
      }
    });
    const unique = new Map(); for (const [v] of found) unique.set(normalized(v), v);
    if (unique.size === 1) return field([...unique.values()][0], found.map((f) => f[1]));
    if (unique.size > 1) return Object.assign(field(null, found.map((f) => f[1]), ''), { note: 'Multiple different values found. Please check.' });
    return field();
  }

  function extractName(lines) {
    const isName = (v) => v.length >= 3 && v.length <= 90 && !/\d|:|institute|national|occupational|certificate|training|safety|health|company|passport|\bnama\b|no\./i.test(v);
    let name = labelled(lines, String.raw`^(?:full\s*name|candidate(?:\s*name)?|participant(?:\s*name)?|name|nama)\s*(?::|$)`, isName);
    if (!name.value && !name.evidence.length) {
      for (let i = 0; i < lines.length; i++) {
        if (/^has\s+successfully\s+completed\b/i.test(lines[i]) && i) {
          const c = lines[i - 1];
          if (isName(c) && c.includes(' ')) { name = field(c, [c + '\n' + lines[i]]); break; }
        }
      }
    }
    if (!name.value && !name.evidence.length) {
      name = labelled(lines, String.raw`^(?:this\s+is\s+to\s+certify\s+that|this\s+is\s+certify\s+that)\s*`,
        (v) => isName(v) && v.includes(' ') && !/survival|systems|services|issued\s+by/i.test(v), 1);
    }
    if (!name.value && !name.evidence.length) {
      for (let i = 0; i < lines.length; i++) {
        if (/presents?\s+(?:this|his)\s+certi(?:f|l)icate/i.test(lines[i])) {
          const c = labelled(lines.slice(i + 1, i + 3), String.raw`^to\s*(?::|$)`, isName, 1);
          if (c.value) { name = c; break; }
        }
      }
    }
    if (name.value && !name.value.includes(' ')) name.note = 'The reader may have joined words together. Check the name spacing.';
    return name;
  }

  function splitLines(text) { return (text || '').split(/\r\n|\r|\n|\f|\v|\u2028|\u2029|\x1c|\x1d|\x1e|\x85/).map((l) => l.trim()).filter(Boolean); }

  function detect(text, pages) {
    text = text || '';
    const lines = splitLines(text);
    const [scores, evidence] = scoreText(text);
    let [category, confidence] = confidenceFrom(scores);
    let multi = countCertificates(text, lines);
    const strong = Object.keys(scores).filter((k) => scores[k] >= 6);
    if (strong.length > 1) multi.push('more than one certificate type found: ' + strong.slice().sort().join(', '));
    const pageTypes = [];
    for (const p of pages || []) {
      const [kind, c] = confidenceFrom(scoreText(p)[0]);
      if (kind !== UNKNOWN && c >= CONFIDENCE_THRESHOLD) pageTypes.push(kind);
    }
    if (new Set(pageTypes).size > 1) multi.push('pages look like different certificates: ' + [...new Set(pageTypes)].join(', '));
    multi = [...new Set(multi)];
    if (confidence < CONFIDENCE_THRESHOLD) category = UNKNOWN;
    const name = extractName(lines).value;
    const numbers = certificateNumber(lines);
    const [issued, ig] = dateField(lines, ISSUE_LABEL);
    const [expires, eg] = dateField(lines, EXPIRY_LABEL);
    const notes = [];
    if (ig || eg) notes.push('A numeric date could be read either way; day-first (DD/MM/YYYY) was assumed. Please check.');
    if (issued && expires && expires < issued) notes.push('The expiry date is before the issue date. Please check.');
    if (category === UNKNOWN) notes.push('We could not confidently tell the certificate type. Please choose it manually.');
    const ev = {}; for (const k in evidence) if (scores[k]) ev[k] = evidence[k];
    return {
      category, confidence, scores, evidence: ev, name,
      certificate_number: numbers.length === 1 ? numbers[0] : null,
      certificate_numbers: numbers,
      issue_date: dayFirst(issued), expiry_date: dayFirst(expires),
      provider: provider(lines, name),
      multiple_certificates: multi.length > 0, multiple_reasons: multi,
      warning: multi.length ? 'Multiple certificates detected: this file looks like it has more than one certificate. Please upload them one at a time.' : null,
      notes, needs_manual_type: category === UNKNOWN, version: 'detect-1-js',
    };
  }

  // server.py summarise()
  function summarise(found, filename = 'upload') {
    const unknown = found.category === UNKNOWN || found.confidence < CONFIDENCE_THRESHOLD;
    const status = found.multiple_certificates ? 'multiple' : unknown ? 'unknown' : 'ok';
    return {
      status, can_confirm: status === 'ok', type: unknown ? null : found.category, confidence: found.confidence,
      name: found.name, certificate_number: found.certificate_number, issue_date: found.issue_date,
      expiry_date: found.expiry_date, provider: found.provider, multiple_reasons: found.multiple_reasons, filename,
    };
  }

  const api = { detect, summarise, parseDate, normalized, scoreText, confidenceFrom, TYPES, UNKNOWN, CONFIDENCE_THRESHOLD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CertDetect = api;
})(typeof window !== 'undefined' ? window : globalThis);

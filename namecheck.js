/* Name cross-check: certificate name vs the freelancer's profile name (FAKE demo data only).
 * Case/punctuation-insensitive, ignores titles and connectors (BIN, BINTI, A/L, S/O, MR...),
 * token-overlap scoring with Jaro-Winkler per token (tolerates OCR typos), any word order,
 * initials and missing middle names. Result: match | partial | mismatch | not_found. */
(function (root) {
  const TOKEN_OK = 0.85;      // Jaro-Winkler at or above this = same word (OCR typo tolerance)
  const MATCH_AVG = 0.9;      // average similarity of the matched words needed for "match"
  const STOP = new Set(['BIN', 'BINTI', 'BTE', 'BINTE', 'B', 'BT', 'AL', 'AP', 'SO', 'DO', 'A/L', 'A/P', 'S/O', 'D/O',
    'MR', 'MRS', 'MS', 'MISS', 'ENCIK', 'EN', 'CIK', 'PUAN', 'TUAN', 'DR']);
  const OCR_DIGIT = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '4': 'A', '3': 'E', '6': 'G', '7': 'T' };
  function tokens(name) {
    let s = String(name || '').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/\b([ASD])\s*\/\s*([LPO])\b/g, ' $1/$2 ');           // A / L -> A/L
    return s.split(/[^A-Z0-9\/]+|\/(?![LPO]\b)/).map((w) => w.replace(/[0-9]/g, (d) => OCR_DIGIT[d]))
      .map((w) => (/^[A-Z]\/[LPO]$/.test(w) ? w : w.replace(/\//g, ''))).filter((w) => w && !STOP.has(w));
  }
  function jaro(a, b) {
    if (a === b) return 1; const la = a.length, lb = b.length; if (!la || !lb) return 0;
    const md = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1), ma = new Array(la).fill(false), mb = new Array(lb).fill(false);
    let m = 0; for (let i = 0; i < la; i++) for (let j = Math.max(0, i - md); j < Math.min(lb, i + md + 1); j++) if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = true; m++; break; }
    if (!m) return 0; let t = 0, k = 0;
    for (let i = 0; i < la; i++) if (ma[i]) { while (!mb[k]) k++; if (a[i] !== b[k]) t++; k++; }
    return (m / la + m / lb + (m - t / 2) / m) / 3;
  }
  function jw(a, b) { const j = jaro(a, b); let p = 0; while (p < 4 && a[p] && a[p] === b[p]) p++; return j + p * 0.1 * (1 - j); }
  function tokenSim(a, b) {
    if (a === b) return 1;
    if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 0.9 : 0;   // initial
    return jw(a, b);
  }
  function compare(certName, profileName) {
    const c = tokens(certName), p = tokens(profileName);
    const out = { cert_name: certName || null, profile_name: profileName || null, cert_tokens: c, profile_tokens: p };
    if (!c.length) return Object.assign(out, { result: 'not_found', score: 0 });
    if (!p.length) return Object.assign(out, { result: 'partial', score: 0 });
    const pairs = []; c.forEach((x, i) => p.forEach((y, j) => pairs.push([tokenSim(x, y), i, j])));
    pairs.sort((a, b) => b[0] - a[0]);
    const ui = new Set(), uj = new Set(), matched = [];
    for (const [s, i, j] of pairs) { if (s < TOKEN_OK || ui.has(i) || uj.has(j)) continue; ui.add(i); uj.add(j); matched.push(s); }
    const sum = matched.reduce((a, b) => a + b, 0), shorter = Math.min(c.length, p.length);
    const full = matched.length;
    const score = +(2 * sum / (c.length + p.length)).toFixed(3), coverage = +(full / shorter).toFixed(3);
    const avg = full ? sum / full : 0;
    let result;
    if (!full) result = 'mismatch';
    else if (coverage === 1 && (full >= 2 || (c.length === 1 && p.length === 1)) && avg >= MATCH_AVG) result = 'match';
    else result = 'partial';
    return Object.assign(out, { result, score, coverage, matched: full });
  }
  const api = { compare, tokens, jw, THRESHOLDS: { TOKEN_OK, MATCH_AVG } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NameCheck = api;
})(typeof window !== 'undefined' ? window : this);

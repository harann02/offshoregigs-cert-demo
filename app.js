// OffshoreGigs certificate demo, fully in the browser.
// Text: pdf.js (text layer; OCR if a page has none) and tesseract.js for images.
// Detection: detect.js (port of detect.py / fields.py). Storage: localStorage.
const $ = (id) => document.getElementById(id);
const STORE = 'offshoregigs-certificates';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_BYTES = 20 * 1024 * 1024;
let selected = null, pending = null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val = (v) => v ? `<b>${esc(v)}</b>` : '<b class="nf">Not found</b>';

function parseDMY(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

function expiryChip(expiry, today = new Date()) {
  const d = parseDMY(expiry);
  if (!d) return '<span class="chip grey">No expiry date found</span>';
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((d - t) / 86400000);
  if (days < 0) return `<span class="chip red">Expired on ${esc(expiry)}</span>`;
  if (days < 60) return `<span class="chip amber">Expires in ${days} day${days === 1 ? '' : 's'}</span>`;
  return `<span class="chip green">Valid till ${esc(expiry)}</span>`;
}

// ---------- OPITO verify link ----------
const OPITO_RE = /\b(?:BOSIET|FOET|HUET|CA-?EBS|TSBB|OPITO)\b|^\s*5\d{3}\s*-/i;
const isOpito = (cat) => !!cat && OPITO_RE.test(cat);
// Surname = last word of the name (also for Malaysian names like "AHMAD BIN ALI").
const surname = (name) => { const w = String(name || '').trim().split(/\s+/); return w[w.length - 1] || ''; };
function opitoUrl(name, certNo) {
  return 'https://www.thehubopito.com/public/validate?Surname=' + encodeURIComponent(surname(name)) + '&Ref=' + encodeURIComponent(certNo);
}
function opitoBlock(cat, name, certNo) {
  if (!isOpito(cat) || !certNo) return '';
  return `<div class="opito"><a class="opito-btn" href="${esc(opitoUrl(name, certNo))}" target="_blank" rel="noopener noreferrer">Verify on OPITO ↗</a>
    <button class="copy-btn" type="button" data-copy="${esc(certNo)}">Copy number</button>
    <p class="opito-note">Tick "I'm not a robot" and press Validate on the OPITO page.</p></div>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy-btn'); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; }
  catch { window.prompt('Copy this number:', b.dataset.copy); }
  setTimeout(() => { b.textContent = 'Copy number'; }, 1500);
});

function stamp() {
  $('lastChecked').textContent = new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true});
}
function show(state) {
  $('uploadCard').hidden = state !== 'upload';
  $('reading').hidden = state !== 'reading';
  $('result').hidden = state !== 'result';
}
function error(msg) { $('err').textContent = msg || ''; $('err').hidden = !msg; }
function note(msg) { $('readingNote').textContent = msg; }

// ---------- text extraction ----------
let pdfjsPromise = null, tessPromise = null, worker = null;
function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import(PDFJS).then((lib) => { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return lib; });
  return pdfjsPromise;
}
function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src)); document.head.appendChild(s); });
}
async function ocrWorker() {
  if (!tessPromise) tessPromise = loadScript(TESSERACT).then(async () => { worker = await Tesseract.createWorker('eng'); return worker; });
  return tessPromise;
}
async function ocr(image, psm = '3') {
  note('Reading text from the image (first time downloads the reader, ~10 MB)...');
  const w = await ocrWorker();
  // tesseract.js defaults to PSM 6 (one uniform block), which scrambles certificate
  // layouts (left label column + signature + logo). 3 = automatic layout, 11 = sparse text.
  await w.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await w.recognize(image);
  return data.text || '';
}

// Decorative certificates (script fonts, gold borders, small print) OCR badly at
// phone-photo resolution. Upscale to ~2600px wide, greyscale and stretch contrast.
async function prepare(source, scaleTo = 2600) {
  const bmp = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  const k = Math.max(1, Math.min(4, scaleTo / bmp.width));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = y; hist[y]++; }
  const n = d.length / 4; let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < n * 0.01) lo++;
  acc = 0; while (hi > 0 && (acc += hist[hi]) < n * 0.01) hi--;
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] - lo) * 255 / span)); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(img, 0, 0);
  return c;
}

// How many useful fields a text yields (used to pick the better OCR pass).
function fieldScore(text) {
  const f = CertDetect.detect(text, [text]);
  return ['name', 'certificate_number', 'issue_date', 'expiry_date', 'provider'].filter((k) => f[k]).length + (f.category !== CertDetect.UNKNOWN ? 1 : 0);
}

async function ocrBest(source) {
  const passes = [[3500, '3'], [2600, '11'], [0, '3']];
  let best = '', bestScore = -1;
  for (const [scale, psm] of passes) {
    if (bestScore >= 0) note('Trying again with a different image setting...');
    const text = await ocr(scale ? await prepare(source, scale) : source, psm);
    const score = fieldScore(text);
    if (score > bestScore) { best = text; bestScore = score; }
    if (bestScore >= 5) break;
  }
  return best;
}

// Rebuild lines from pdf.js text items (group by baseline, sort left to right).
function itemsToText(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5], x = it.transform[4];
    let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, (it.height || 10) * 0.4));
    if (!row) rows.push(row = { y, parts: [] });
    row.parts.push({ x, s: it.str, w: it.width || 0 });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = '', end = null;
    for (const p of r.parts) { out += (end !== null && p.x - end > 1 && !out.endsWith(' ') && !p.s.startsWith(' ') ? ' ' : '') + p.s; end = p.x + p.w; }
    return out;
  }).join('\n');
}

async function pdfPages(buffer) {
  note('Opening PDF...');
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    let text = itemsToText((await page.getTextContent()).items);
    if (text.replace(/\s/g, '').length < 20) {
      // No usable text layer (scanned PDF): render the page and OCR it.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const ocrText = await ocrBest(canvas);
      if (ocrText.trim().length > text.trim().length) text = ocrText;
    }
    pages.push(text);
  }
  return pages;
}

async function readCertificate(file) {
  if (!file.size || file.size > MAX_BYTES) throw new Error('The file must not be empty or larger than 20 MB.');
  const buffer = new Uint8Array(await file.arrayBuffer());
  const head = String.fromCharCode(...buffer.slice(0, 8));
  let pages;
  if (head.startsWith('%PDF-')) pages = await pdfPages(buffer);
  else if (head === '\x89PNG\r\n\x1a\n' || (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) pages = [await ocrBest(file)];
  else throw new Error('Only PDF, PNG or JPG files are supported.');
  const found = CertDetect.detect(pages.join('\n'), pages);
  const text = pages.join('\n');
  const result = CertDetect.summarise(found, file.name || 'upload', { text, categories: OGCategories.all() });
  window.lastScan = { pages, found, result }; // handy for debugging/tests
  return result;
}

// ---------- storage ----------
const items = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
const save = (list) => localStorage.setItem(STORE, JSON.stringify(list));

// ---------- UI ----------
function pick(file) {
  selected = file || null;
  $('fileName').textContent = selected ? selected.name : 'Tap to select a file';
  $('fileBox').classList.toggle('has', !!selected);
  error('');
}
$('file').addEventListener('change', (e) => pick(e.target.files[0]));

$('sampleLink').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch('samples/sample-bosiet-FAKE.pdf');
    if (!res.ok) throw new Error('Could not load the sample.');
    pick(new File([await res.blob()], 'sample-bosiet-FAKE.pdf', { type: 'application/pdf' }));
  } catch (err) { error(err.message); }
});

$('uploadBtn').addEventListener('click', async () => {
  if (!selected) { error('Please tap to select a file first.'); return; }
  error(''); note('This can take a few seconds.'); show('reading');
  try { renderResult(await readCertificate(selected)); }
  catch (err) { show('upload'); error(err.message || 'Could not read this file.'); }
});

function renderResult(r) {
  pending = r;
  let head = '', warn = '', rows = '', confirm = '';
  if (r.status === 'multiple') {
    head = '<h4>More than one certificate found</h4>';
    warn = `<div class="warn red"><b>Multiple certificates detected</b>This file looks like it has more than one certificate. Please upload one certificate at a time.</div>`;
  } else if (r.status === 'unknown') {
    head = '<h4>Certificate not recognised</h4>';
    warn = `<div class="warn amber">We couldn't recognise this certificate. Please upload a clearer copy.</div>`;
  } else if (r.status === 'not_listed') {
    head = `<h4>This certificate isn't in our list yet</h4><p class="det">We read this certificate, but its type is not in the OffshoreGigs category list.</p>`;
    rows = `<div class="rows"><div class="row"><span>Detected title</span><b id="detTitle">${esc(r.detected_title)}</b></div>
      <div class="row"><span>Name</span>${val(r.name)}</div>
      <div class="row"><span>Expiry date</span>${val(r.expiry_date)}</div></div>`;
    const prior = OGCategories.requests().find((q) => q.status === 'Pending' && q.detected_title.toLowerCase() === String(r.detected_title).toLowerCase());
    confirm = prior ? '<div class="warn green" id="reqSent">Request sent - our team will review it</div>'
      : '<button class="teal" id="requestBtn" type="button">Request to add this category</button><div class="warn green" id="reqSent" hidden>Request sent - our team will review it</div>';
  } else {
    head = `<h4>We detected: ${esc(r.category)}</h4><p class="det">Read from your document. These details cannot be edited.</p>`;
    if (r.expired) warn = `<div class="warn red" id="expiredWarn"><b>Expired on ${esc(r.expiry_date)}</b>This certificate has expired. You can still add it, but it will show as expired and may not be accepted for jobs.</div>`;
    rows = `<div class="rows">
      <div class="row"><span>Category</span><b id="catName">${esc(r.category)}</b></div>
      <div class="row"><span>Name</span>${val(r.name)}</div>
      <div class="row"><span>Certificate No</span>${val(r.certificate_number)}</div>
      <div class="row"><span>Issue date</span>${val(r.issue_date)}</div>
      <div class="row"><span>Expiry date</span>${r.expired ? `<b class="exp">${esc(r.expiry_date)} (expired)</b>` : val(r.expiry_date)}</div></div>`;
    rows += opitoBlock(r.category, r.name, r.certificate_number);
    confirm = `<button class="teal" id="confirmBtn" type="button">${r.expired ? 'Confirm (expired)' : 'Confirm'}</button>`;
  }
  $('result').innerHTML = head + warn + rows + confirm +
    '<button class="ghost" id="cancelBtn" type="button">Cancel / Upload again</button><p class="err" id="resErr" hidden></p>';
  show('result');
  $('cancelBtn').onclick = cancel;
  if ($('confirmBtn')) $('confirmBtn').onclick = confirmIt;
  if ($('requestBtn')) $('requestBtn').onclick = () => {
    OGCategories.request(r.detected_title, r.filename);
    $('requestBtn').hidden = true; $('reqSent').hidden = false;
  };
}

function cancel() {
  pending = null; selected = null; $('file').value = '';
  $('fileName').textContent = 'Tap to select a file'; $('fileBox').classList.remove('has');
  show('upload');
}

function confirmIt() {
  if (!pending || !pending.can_confirm) { $('resErr').textContent = 'This certificate cannot be confirmed.'; $('resErr').hidden = false; return; }
  const item = {};
  item.type = pending.category;
  for (const k of ['category', 'detected_title', 'name', 'certificate_number', 'issue_date', 'expiry_date', 'filename']) item[k] = pending[k];
  Object.assign(item, { id: Math.random().toString(16).slice(2) + Date.now().toString(16), verified_from_document: true, confirmed_at: new Date().toISOString() });
  const list = items(); list.unshift(item); save(list);
  cancel(); load();
}

function load() {
  const list = items();
  stamp();
  if (!list.length) {
    $('list').innerHTML = '<div class="card empty"><span class="ico">🔍</span>No certificates yet. Upload one above.</div>';
    return;
  }
  $('list').innerHTML = list.map((c) => `
    <div class="card item">
      <div class="item-top"><h5>${esc(c.type)}</h5></div>
      <div class="meta">${esc(c.name || 'Name not found')}<br>No: ${esc(c.certificate_number || 'Not found')}</div>
      <div class="chips">${expiryChip(c.expiry_date)}<span class="chip ver">✓ Verified from document</span></div>
      ${opitoBlock(c.category || c.type, c.name, c.certificate_number)}
    </div>`).join('');
}

$('refreshBtn').addEventListener('click', load);
show('upload'); load();

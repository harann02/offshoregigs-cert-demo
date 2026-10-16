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
  if (days < 0) return `<span class="chip red">Expired ${esc(expiry)}</span>`;
  if (days < 60) return `<span class="chip amber">Expires in ${days} day${days === 1 ? '' : 's'}</span>`;
  return `<span class="chip green">Valid till ${esc(expiry)}</span>`;
}

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
async function ocr(image) {
  note('Reading text from the image (first time downloads the reader, ~10 MB)...');
  const w = await ocrWorker();
  const { data } = await w.recognize(image);
  return data.text || '';
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
      const ocrText = await ocr(canvas);
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
  else if (head === '\x89PNG\r\n\x1a\n' || (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) pages = [await ocr(file)];
  else throw new Error('Only PDF, PNG or JPG files are supported.');
  const found = CertDetect.detect(pages.join('\n'), pages);
  const result = CertDetect.summarise(found, file.name || 'upload');
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
  } else {
    head = `<h4>We detected: ${esc(r.type)}</h4><p class="det">Read from your document. These details cannot be edited.</p>`;
    rows = `<div class="rows">
      <div class="row"><span>Name</span>${val(r.name)}</div>
      <div class="row"><span>Certificate No</span>${val(r.certificate_number)}</div>
      <div class="row"><span>Issue date</span>${val(r.issue_date)}</div>
      <div class="row"><span>Expiry date</span>${val(r.expiry_date)}</div>
      <div class="row"><span>Provider</span>${val(r.provider)}</div></div>`;
    confirm = '<button class="teal" id="confirmBtn" type="button">Confirm</button>';
  }
  $('result').innerHTML = head + warn + rows + confirm +
    '<button class="ghost" id="cancelBtn" type="button">Cancel / Upload again</button><p class="err" id="resErr" hidden></p>';
  show('result');
  $('cancelBtn').onclick = cancel;
  if ($('confirmBtn')) $('confirmBtn').onclick = confirmIt;
}

function cancel() {
  pending = null; selected = null; $('file').value = '';
  $('fileName').textContent = 'Tap to select a file'; $('fileBox').classList.remove('has');
  show('upload');
}

function confirmIt() {
  if (!pending || !pending.can_confirm) { $('resErr').textContent = 'This certificate cannot be confirmed.'; $('resErr').hidden = false; return; }
  const item = {};
  for (const k of ['type', 'name', 'certificate_number', 'issue_date', 'expiry_date', 'provider', 'filename']) item[k] = pending[k];
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
      <div class="meta">${esc(c.name || 'Name not found')}<br>No: ${esc(c.certificate_number || 'Not found')} · Provider: ${esc(c.provider || 'Not found')}</div>
      <div class="chips">${expiryChip(c.expiry_date)}<span class="chip ver">✓ Verified from document</span></div>
    </div>`).join('');
}

$('refreshBtn').addEventListener('click', load);
show('upload'); load();

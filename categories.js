/* OffshoreGigs certificate categories + category requests (demo storage).
 * BASE list: exact names from the OffshoreGigs admin certificate catalogue snapshot
 * (offshoregigs-document-checker/categories.json, "OffshoreGigs admin certificate catalogue", captured 2026-10-16, 51 enabled entries).
 * DEMO ONLY: approved additions and requests live in this browser's localStorage.
 * The real app needs a backend table (e.g. certificate_category_requests) shared by all users. */
(function (root) {
  'use strict';
  const BASE = [
  "5501 - T BOSIET",
  "5502 - T BOSIET & TSBB",
  "5508 - T BOSIET WITH CAEBS",
  "5509 - T BOSIET WITH CAEBS & TSBB",
  "5513 - T FOET & TSBB (I)",
  "5523 - T FOET & TSBB (F)",
  "5605 - TSBB",
  "5614 - T FOET",
  "5655 - F TSBB",
  "5700 - BOSIET WITH EBS",
  "5707 - BOSIET WITH CAEBS & TSBB (I)",
  "5808 -  FOET WITH EBS & TSBB (I)",
  "5902 - CA-EBS (INITIAL)",
  "5903 - SHALLOW WATER CAEBS",
  "5905 - T BOSIET WITH EBS",
  "ADVANCE FIRST AID",
  "AESP - CONFINED SPACE",
  "BASIC FIRST AID",
  "BASIC H2S",
  "BOSIET WITH EBS & TSBB (I)",
  "BP IMM LEVEL 1",
  "BP IMM LEVEL 2",
  "CIDB Certificate",
  "CV / Work Experience",
  "DESIGNATED FIRST AIDER",
  "DOSH Scaffolder Cert",
  "FIRE WATCHER",
  "FOET",
  "FOET WITH EBS",
  "FOET WITH EBS & TSBB (F)",
  "FOET WITH EBS & TSBB (I)",
  "IC Malaysia",
  "MERCURY AWARENESS",
  "NEXT OF KIN",
  "OGSP",
  "Passport (Malaysian)",
  "PERMIT TO WORK - SHELL",
  "PERMIT TO WORK LEVEL 1 - PETRONAS",
  "PERMIT TO WORK LEVEL 2 - PETRONAS",
  "Petronas Medical (Offshore)",
  "Petronas Medical (Onshore)",
  "RIGGING & SLINGING AWARENESS",
  "SCAFFOLDER LEVEL 1",
  "SCAFFOLDER LEVEL 2",
  "SCAFFOLDER LEVEL 3",
  "Seaman Book",
  "Site Safety Supervisor - Yellow Book",
  "VACCINE CERTIFICATE",
  "WORKING AT HEIGHT (WAH) BASIC",
  "WORKING AT HEIGHT (WAH) LEVEL 2",
  "WORKING AT HEIGHT (WAH) LEVEL 3 - RESCUE"
];
  const ADDED = 'offshoregigs-categories-added';
  const REQUESTS = 'offshoregigs-category-requests';
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const OGCategories = {
    BASE,
    added: () => read(ADDED),
    all: () => BASE.concat(read(ADDED).filter((n) => !BASE.includes(n))),
    requests: () => read(REQUESTS),
    request(title, filename) {
      const list = read(REQUESTS);
      const existing = list.find((r) => r.status === 'Pending' && r.detected_title.toLowerCase() === String(title).toLowerCase());
      if (existing) return existing;
      const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), detected_title: title,
        file_name: filename, date: new Date().toISOString(), status: 'Pending' };
      list.unshift(r); write(REQUESTS, list); return r;
    },
    // Manual category submission for an unmatched document (Pending approval).
    submit(o) {
      const list = read(REQUESTS);
      const isNew = o.kind === 'name' ? false : !OGCategories.all().some((n) => n.toLowerCase() === String(o.category).toLowerCase());
      const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: o.kind || 'manual',
        reason: o.reason || 'category', cert_name: o.cert_name || null, profile_name: o.profile_name || null,
        category: o.category, detected_title: o.category, is_new: isNew, file_name: o.file_name,
        fields: o.fields || {}, cert_id: o.cert_id, date: new Date().toISOString(), status: 'Pending' };
      list.unshift(r); write(REQUESTS, list); return r;
    },
    decide(id, approve) {
      const list = read(REQUESTS); const r = list.find((x) => x.id === id);
      if (!r) return null;
      r.status = approve ? 'Approved' : 'Rejected'; r.decided_at = new Date().toISOString();
      write(REQUESTS, list);
      const title = r.category || r.detected_title;
      if (approve && (r.kind !== 'manual' || r.is_new)) { const a = read(ADDED); if (!OGCategories.all().includes(title)) { a.push(title); write(ADDED, a); } }
      if (r.cert_id) {
        const certs = read('offshoregigs-certificates'); const c = certs.find((x) => x.id === r.cert_id);
        if (c) { c.approval = approve ? 'approved' : 'rejected'; c.decided_at = r.decided_at; write('offshoregigs-certificates', certs); }
      }
      return r;
    },
  };
  root.OGCategories = OGCategories;
})(window);

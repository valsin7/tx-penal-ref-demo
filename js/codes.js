// Multi-code helpers (pure; shared by the app and tests/codes.test.mjs).
export const CODES = {
  PE: {name: 'Penal Code', chip: 'Penal', cite: 'PC'},
  TN: {name: 'Transportation Code', chip: 'Traffic', cite: 'Transp.'},
  CR: {name: 'Code of Criminal Procedure', chip: 'CCP', cite: 'CCP art.'},
  HS: {name: 'Health & Safety Code, ch. 481', chip: 'Drugs', cite: 'H&S'},
  AL: {name: 'Alcoholic Beverage Code', chip: 'ABC', cite: 'Alc. Bev.'},
  FA: {name: 'Family Code', chip: 'Family', cite: 'Fam.'},
  PW: {name: 'Parks & Wildlife Code', chip: 'Parks & Wildlife', cite: 'P&W'},
  AR: {name: 'Arlington City Code (sample)', chip: 'Arlington', cite: 'Arlington'}};
export const FILTERS = ['all', 'PE', 'TN', 'CR', 'HS', 'AL', 'FA', 'PW', 'AR'];
export const GRADE_LABEL = {CAP: 'Capital felony', F1: '1st-degree felony', F2: '2nd-degree felony', F3: '3rd-degree felony', SJF: 'State jail felony',
  A: 'Class A misdemeanor', B: 'Class B misdemeanor', C: 'Class C misdemeanor', FINE: 'Fine only', U: 'Unclassified (see text)',
  PWA: 'Class A P&W misdemeanor', PWB: 'Class B P&W misdemeanor', PWC: 'Class C P&W misdemeanor', PWF: 'P&W Code felony', PWSJF: 'P&W state jail felony'};
export const citeOf = (code, id) => `${CODES[code]?.cite || code} ${id}`;
const STOP = new Set('a an the of in on to for with and or is was by at from into his her their he she it what who when how under over code section sec tx texas no not without'.split(' '));
export const norm = s => (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const stem = w => w.length > 4 ? w.replace(/(ings|ing|ed|es|s)$/, '') : w;
export const toks = s => norm(s).split(/[\s-]+/).map(w => w.replace(/^\.+|\.+$/g, '')).filter(w => w && !STOP.has(w)).map(stem);
export const secNum = q => (String(q).match(/\b(\d{1,3}[A-Z]?\.\d{2,5}[A-Za-z]?)\b/) || [])[1];
const cache = new WeakMap();
function titleToks(index) { if (!cache.has(index)) cache.set(index, index.s.map(r => new Set(toks(r[1])))); return cache.get(index); }
// Title + section-number search over a code index ({s:[[id,title,chapter,repealed,firstGrade]]}). Not full text.
export function searchIndex(q, code, index, limit = 12) {
  const n = secNum(q), qt = toks(q).filter(w => !/^\d/.test(w)); const T = titleToks(index); const out = [];
  index.s.forEach((r, i) => { let sc = 0;
    if (n && r[0] === n) sc += 100; else if (n && r[0].startsWith(n) && /^\d+\.\d+$/.test(n)) sc += 20;
    if (qt.length) { const hit = qt.filter(w => T[i].has(w) || (w.length >= 5 && [...T[i]].some(t => t.startsWith(w)))).length;
      if (hit && hit >= Math.ceil(qt.length * 0.6)) sc += 10 * hit / qt.length + hit; }
    if (r[3]) sc *= 0.3;
    if (sc > 0) out.push({code, id: r[0], title: r[1], chapter: r[2], repealed: !!r[3], grade: r[4], score: sc}); });
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en', {numeric: true})).slice(0, limit);
}
// Curated patrol cards: match on section number, name, and aka phrases.
export function searchCards(q, cards) {
  const nq = norm(q), n = secNum(q), qt = toks(q).filter(w => !/^\d/.test(w)); const out = [];
  for (const c of cards) { let sc = 0;
    if (n && c.sec === n) sc += 100;
    let ak = 0; for (const a of c.aka || []) { const na = norm(a); if (nq && (nq === na)) ak = 80; else if (nq.length >= 3 && (nq.includes(na) || na.includes(nq))) ak = Math.max(ak, 50); } sc += ak;
    const nt = new Set(toks(c.name + ' ' + (c.aka || []).join(' ')));
    const hit = qt.filter(w => nt.has(w)).length; if (qt.length && hit >= Math.ceil(qt.length * 0.6)) sc += 15 * hit / qt.length;
    if (sc > 0) out.push({card: c, score: sc}); }
  return out.sort((a, b) => b.score - a.score);
}
export function searchArlington(q, arl) {
  if (!arl) return []; const qt = toks(q).filter(w => !/^\d/.test(w)); if (!qt.length) return [];
  return arl.items.map(it => { const t = new Set(toks([it.title, it.topic, it.sec, ...(it.quotes || []).map(x => x.quote)].join(' ')));
    const hit = qt.filter(w => t.has(w)).length; return {item: it, score: hit / qt.length}; }).filter(x => x.score >= 0.6).sort((a, b) => b.score - a.score);
}
export const cardsFor = (cards, code, sec) => cards.filter(c => c.code === code && c.sec === sec);
export const filterOfCard = c => c.xref || c.code;
// "HS 481.115(b)" / "CR 14.06(d)(7)" / "22.01(b)(2)" -> {code, id}
export function parseCite(c) {
  let m = String(c).match(/^(PE|TN|CR|HS|AL|FA|PW)\s+(\d+[A-Z]?\.\d+[A-Za-z]?)/); if (m) return {code: m[1], id: m[2]};
  m = String(c).match(/^(?:PC\s+)?(\d+[A-Z]?\.\d+)/); return m ? {code: 'PE', id: m[1]} : null;
}
export const hrefOf = (code, id) => code === 'PE' ? `#/s/${id}` : `#/x/${code}/${id}`;
export const favKey = (code, id) => code === 'PE' ? id : `${code}:${id}`;
export const parseFav = k => k.includes(':') ? {code: k.split(':')[0], id: k.split(':')[1]} : {code: 'PE', id: k};

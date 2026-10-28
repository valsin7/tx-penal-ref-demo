// TX Law Quick Ref: DEMO app (built by scripts/build_demo.py into dist-demo/). It reads ONE data file, data/demo.json,
// which holds only the sample items in demo/demo.config.json. Anything else (other sections and codes, browsing,
// the CCP guide, case law, other patrol cards and calculators, favorites, "Download all") shows a locked
// "Available in the full version" screen. No accounts, no payments, nothing sent anywhere.
import {ICON} from './icons.js';
import {CODES, GRADE_LABEL, citeOf, hrefOf, toks, norm, secNum, parseCite} from './codes.js';
import {calcPossess} from './possess.js';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const LS = {get(k, d) { try { return JSON.parse(localStorage.getItem('txpc.' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('txpc.' + k, JSON.stringify(v)); } catch {} }};
const view = $('#view');
const LOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>';
const ORDER = ['CAP', 'F1', 'F2', 'F3', 'SJF', 'A', 'B', 'C'];
const badge = g => String(g).split('/').map(x => `<span class="badge g-${ORDER.includes(x) || x === 'FINE' ? x : 'X'}">${esc(GRADE_LABEL[x] || x)}</span>`).join('');
const tc = s => esc((s || '').toLowerCase());
let D = null; const key = (code, id) => code + ':' + id; let BY = new Map();
const load = async () => { if (!D) { const r = await fetch('data/demo.json'); if (!r.ok) throw new Error('demo.json HTTP ' + r.status); D = await r.json(); BY = new Map(D.sections.map(s => [key(s.code, s.id), s])); } return D; };
const has = (code, id) => BY.has(key(code, id));
const cardsOf = (code, id) => D.cards.filter(c => c.code === code && c.sec === id);

// ---- theme ----
const themeIcon = () => { const dark = document.documentElement.dataset.theme === 'dark'; $('#themeBtn').innerHTML = dark ? ICON.sun : ICON.moon; $('#themeBtn').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); };
function setTheme(t) { document.documentElement.dataset.theme = t; LS.set('theme', t); themeIcon(); document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0b1220' : '#13284b'; }
themeIcon(); $('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

// ---- locked screen ----
const CTA = 'Contact us for the full version';
function viewLocked(what) {
  view.innerHTML = `<div class="card lockcard" id="locked"><div class="lockico">${LOCK}</div><div class="kicker">Demo</div><h2>Available in the full version</h2>
  <p class="what">${esc(what)}</p><p class="small muted">This demo includes ${D ? D.scope.charge.length : 10} sample charge cards, ${D ? D.cards.length : 4} patrol cards and a possession calculator. Everything else is in the full version.</p>
  <div class="ctaline">${CTA}</div>
  <div class="btnrow"><a class="btn" href="#/">Back to the demo</a></div></div>`;
}
const lockedRow = (label, sub) => `<a class="locked" href="#/locked"><span><span class="lk">${LOCK}</span> ${esc(label)}${sub ? ` <span class="small muted">${esc(sub)}</span>` : ''}</span><span class="tag">Full version</span></a>`;

// ---- shared renderers (same markup as the full app) ----
const qref = (code, sec, path) => CODES[code] ? `<a class="cite" href="${hrefOf(code, sec)}">${esc(citeOf(code, sec) + (path || ''))}</a>` : '';
const citeLink = c => { const p = parseCite(c); if (!p) return `<span class="cite">${esc(c)}</span>`;
  const shown = p.code === 'PE' ? (/^PC /.test(c) ? c : 'PC ' + c) : String(c).replace(/^(TN|CR|HS|AL|FA|PW)\s+/, CODES[p.code].cite + ' ');
  return `<a class="cite" href="${hrefOf(p.code, p.id)}">${esc(shown)}</a>`; };
const ARREST = {arrest: ['Custodial arrest', 'arrest'], citation: ['Citation allowed', 'citation'], notice: ['Citation required (notice to appear)', 'citation'], ambiguous: ['Unclear: verify', 'guide'], stub: ['Not modeled: verify', 'guide']};
const arrestHTML = a => a ? `<div class="arr arr-${a.kind}"><div class="arrk">${ICON[ARREST[a.kind]?.[1] || 'guide']}<span>${esc(ARREST[a.kind]?.[0] || a.kind)}</span></div><div class="small">${esc(a.t)}</div><div class="arrc">${(a.cites || []).map(([c, s, p]) => qref(c, s, p)).join(' ')}</div></div>` : '';
const fmtFine = f => f ? (f[0] ? `$${f[0].toLocaleString()}–$${f[1].toLocaleString()} fine` : `fine up to $${f[1].toLocaleString()}`) : '';
const penHTML = p => `<div class="pen"><div class="penrow">${badge(p.grade)}${p.fine ? `<span class="fine">${fmtFine(p.fine)}</span>` : ''}</div><div class="penlabel">${esc(p.label)}</div>
  <blockquote class="q">“${esc(p.quote)}” ${qref(p.src.code, p.src.sec, p.src.path)}</blockquote>${p.fineQuote ? `<blockquote class="q">“${esc(p.fineQuote)}”</blockquote>` : ''}${arrestHTML(p.arrest)}</div>`;
function cardHTML(c) {
  const quotes = [...c.elements.map(e => [e[2], e[3]]), ...(c.defenses || []).map(d => [d.path, d.quote]), ...(c.notes || []).map(d => [d.path, d.quote])];
  const list = (h, xs) => xs?.length ? `<h4>${h}</h4><ul class="plist">${xs.map(d => `<li>${esc(d.text)} ${qref(d.code || c.code, d.sec || c.sec, d.path)}</li>`).join('')}</ul>` : '';
  return `<div class="card pcard"><div class="kicker">${ICON[c.code]} Patrol card</div><h3 class="pctitle">${esc(c.name)}</h3>
  ${c.xref ? `<div class="small muted">Cross-reference for ${esc(CODES[c.xref].name)}</div>` : ''}
  <h4>Elements</h4><ol class="steps">${c.elements.map(([k, t, p]) => `<li><span class="elk">${esc(k)}</span> ${esc(t)} ${qref(c.code, c.sec, p)}</li>`).join('')}</ol>
  ${c.penaltyNote ? `<p class="small pnote">${esc(c.penaltyNote)}</p>` : ''}
  ${c.penalties.length ? `<h4>Grade · fine · arrest or citation</h4>${c.penalties.map(penHTML).join('')}` : ''}
  ${list('Defenses / exceptions', c.defenses)}${list('Notes', c.notes)}
  ${c.related?.length ? `<h4>Related</h4><div class="rel">${c.related.map(r => `<a class="chip" href="${hrefOf(r.code, r.sec)}">${esc(citeOf(r.code, r.sec) + (r.path || ''))}</a>`).join('')}</div>` : ''}
  <details class="qd"><summary class="small">Verbatim phrases checked (${quotes.length})</summary><ul class="small">${quotes.map(([p, q]) => `<li>${esc(p || '(section)')}: “${esc(q)}”</li>`).join('')}</ul></details>
  <div class="verify">⚠ <b>Verify against official text.</b> Plain-language summary; every quoted phrase was checked verbatim against the official text at build time. The full official text controls.</div></div>`;
}
function punLine(g) {
  const p = D.punishments[g]; if (!p) return '';
  const fine = p.fineMax ? `fine up to $${p.fineMax.toLocaleString()}` : '';
  if (p.confinement === 'jail') return `Jail up to ${p.jailMax} and/or ${fine} · PC ${p.section}`;
  if (!p.confinement) return `${fine[0].toUpperCase() + fine.slice(1)} only · PC ${p.section}`;
  return `${p.confinement === 'TDCJ' ? 'TDCJ' : 'State jail'} ${p.prisonMin} to ${p.prisonMax}${p.life ? ' or life' : ''}; optional ${fine} · PC ${p.section}`;
}
const gradesOf = s => [...new Set(s.grades ? s.grades.flatMap(r => r.g.split('/')) : s.gradeLines.flatMap(g => g.grades))].filter(g => D.punishments[g]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
function elementsHTML(s) {
  if (!s.elements?.length) return '';
  return `<div class="card elements"><h4>Elements checklist</h4>
  ${s.elements.map(x => `<div class="elvar"><div class="ellabel">${esc(x.label)}</div><ol>${x.items.map(([k, t, c]) => `<li><span class="elk">${esc(k)}</span> ${esc(t)} <span class="cite">PC ${/^\d/.test(c) ? '' : esc(s.id)}${esc(c)}</span></li>`).join('')}</ol></div>`).join('')}
  <div class="verify">⚠ <b>Verify against official text.</b> Plain-language paraphrase of the cited subsections (hand-curated). The full official text below controls.</div></div>`;
}
const linesHTML = s => s.lines.map(l => l.note ? `<p class="n">${esc(l.t)}</p>` : `<p class="i${Math.min(l.i, 4)}">${esc(l.t)}</p>`).join('');
const isCalc = (code, id) => code === 'HS' && Object.values(D.calc.possess).includes(id);

// ---- section / charge card ----
function viewSection(code, id) {
  const s = BY.get(key(code, id));
  if (!s) return viewLocked(`${citeOf(code, id)} is not in this demo.`);
  const gs = gradesOf(s), pe = code === 'PE';
  view.innerHTML = `<div class="card shead"><div class="sechead"><div><div class="kicker">${ICON[code]} ${esc(CODES[code].name)} ${s.charge ? '<span class="tag">Sample charge card</span>' : ''}</div><div class="sec">${esc(citeOf(code, id))}</div><h2>${tc(s.title)}</h2>
    <div class="small muted capz">${tc(s.chapterTitle)}${s.subchapter ? ' · ' + tc(s.subchapter) : ''}</div></div></div>
    <div class="btnrow"><a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">Official statute ${ICON.ext}</a>${lastQuery ? `<a class="btn ghost" href="#/search?q=${encodeURIComponent(lastQuery)}">← Results</a>` : ''}</div></div>
  ${cardsOf(code, id).map(cardHTML).join('')}
  ${isCalc(code, id) ? `<a class="card cta" href="#/calc/possess"><span class="ctaico">${ICON.calc}</span><span><b>Possession calculator</b><span class="small">Grade and range by amount, ${esc(citeOf(code, id))}</span></span><span class="chev">${ICON.chev}</span></a>` : ''}
  ${elementsHTML(s)}
  ${pe ? `<div class="card"><h4>Offense grades</h4>
    ${s.grades ? `<table>${s.grades.map(r => `<tr><td>${badge(r.g)}</td><td>${esc(r.when)}<div class="small muted">${esc(r.cite)}</div></td></tr>`).join('')}</table>
      <p class="small muted">Quick summary hand-curated from the official text of this section (cited subsections). The full text below controls.</p>`
    : s.gradeLines.length ? `<p class="small muted">Grade language found automatically in the official text:</p>${s.gradeLines.map(g => `<div class="hint">${g.grades.map(badge).join('')} <span class="cite">${esc(g.path)}</span> ${esc(g.t || '')}</div>`).join('')}`
    : `<p class="muted small">No offense grade stated in this section.</p>`}</div>` : ''}
  ${pe && gs.length ? `<div class="card"><h4>Punishment range (PC ch. 12)</h4><table>${gs.map(g => `<tr><td>${badge(g)}</td><td class="small">${esc(punLine(g))}</td></tr>`).join('')}</table></div>` : ''}
  ${pe && s.enhLines?.length ? `<div class="card"><h4>Enhancements</h4><p class="small muted">Stated in this section (verbatim):</p>${s.enhLines.slice(0, 8).map(e => `<div class="hint small"><span class="cite">${esc(e.path)}</span> ${esc(e.t.length > 260 ? e.t.slice(0, 260) + '…' : e.t)}</div>`).join('')}
    <div class="lockrow small muted" style="margin-top:8px">${LOCK} Repeat-offender and enhancement calculators: full version</div></div>` : ''}
  <div class="card"><details ${s.lines.length < 14 || !cardsOf(code, id).length ? 'open' : ''}><summary>Official text (${s.lines.length} paragraphs)</summary><div class="law">${linesHTML(s)}</div>
    ${s.history?.length ? `<details><summary class="small">Source notes / history</summary><div class="small muted">${s.history.map(esc).join('<br>')}</div></details>` : ''}</details>
    <p class="src">Text: ${esc(s.src.name)}, statutes.capitol.texas.gov bulk download (${esc(s.src.fetched)}). <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></p></div>`;
}

// ---- home ----
const itemRes = s => `<a class="card res" href="${hrefOf(s.code, s.id)}"><div class="sec">${ICON[s.code]} ${esc(citeOf(s.code, s.id))}</div><h3>${tc(s.title)}</h3><div>${(s.code === 'PE' ? gradesOf(s) : [...new Set((cardsOf(s.code, s.id)[0]?.penalties || []).map(p => p.grade))]).map(badge).join('')}</div></a>`;
const cardRes = c => `<a class="card res pres" href="${hrefOf(c.code, c.sec)}"><div class="sec">${ICON[c.code]} ${esc(citeOf(c.code, c.sec))} <span class="tag">Patrol card</span></div><h3 class="nc">${esc(c.name)}</h3>
  <div>${[...new Set(c.penalties.map(p => p.grade))].map(badge).join('')}</div></a>`;
const HOME_CODES = ['PE', 'TN', 'CR', 'HS', 'AL', 'FA'];
function viewHome() {
  const charge = D.scope.charge.map(([c, i]) => BY.get(key(c, i)));
  view.innerHTML = `<section class="hero"><div class="kicker">Texas statutes · field reference · demo</div><h1>Find the law fast.</h1>
  <form class="searchbox" role="search" id="homeSearch"><span class="sico">${ICON.search}</span><input id="hq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search the demo items" aria-label="Search the demo items"></form></section>
  <div class="card demonote" role="note"><b>Demo version</b><span class="small">${charge.length} sample charge cards, ${D.cards.length} patrol cards and a possession calculator. Everything else is locked and available in the full version.</span></div>
  <div class="qa">${[['#/search', 'search', 'Search', 'Demo items, offline', ''], ['#/calc', 'calc', 'Calculators', 'Possession (demo)', ''], ['#/saved', 'saved', 'Saved', 'Full version', ' locked'], ['#/settings', 'settings', 'Settings', 'Offline, disclaimer', '']]
    .map(([h, i, t, s, l]) => `<a class="qact${l}" href="${h}">${ICON[i]}<span class="qt">${t}</span><span class="qs">${s}</span></a>`).join('')}</div>
  <h3 class="grouph">Sample charge cards</h3>${charge.map(itemRes).join('')}
  <h3 class="grouph">Patrol cards</h3>${D.cards.map(cardRes).join('')}
  <h3 class="grouph">Codes</h3><div class="tiles codes">${HOME_CODES.map(c => `<a class="tile t-${c} locked" href="#/code/${c}"><span class="tico">${ICON[c]}</span><span class="tt">${esc(CODES[c].chip)}</span><span class="ts">${LOCK} Full version</span></a>`).join('')}</div>
  <p class="src">Official text from the Texas Legislature (statutes.capitol.texas.gov), fetched ${esc(D.fetched)}. Runs on your device: no accounts, nothing sent anywhere. Only the theme and your disclaimer acknowledgment are stored, locally. <a href="#/settings">Settings</a></p>`;
  $('#homeSearch').onsubmit = e => { e.preventDefault(); const v = $('#hq').value.trim(); location.hash = '#/search' + (v ? '?q=' + encodeURIComponent(v) : ''); };
}

// ---- search (demo items only) ----
let lastQuery = '';
const EXAMPLES = ['dwi', 'shoplifting', 'marihuana', 'trespass', 'evading', 'resisting arrest', 'public intoxication', 'cocaine'];
let IDXS = null;
function buildIdx() {
  if (IDXS) return IDXS;
  IDXS = D.sections.map(s => { const cs = cardsOf(s.code, s.id); const syn = D.synonyms.filter(x => s.code === 'PE' && x.ids.includes(s.id));
    const subs = isCalc(s.code, s.id) ? D.calc.substances.filter(x => D.calc.possess[x.group] === s.id).map(x => x.name) : [];
    const strong = [s.title, ...cs.flatMap(c => [c.name, ...(c.aka || [])]), ...syn.flatMap(x => x.p), ...subs];
    return {s, phrases: strong.map(norm), strong: new Set(toks(strong.join(' '))), text: new Set(toks(s.lines.map(l => l.t).join(' ')))}; });
  return IDXS;
}
export function searchDemo(q) {
  const nq = norm(q), n = secNum(q), qt = toks(q).filter(w => !/^\d/.test(w));
  return buildIdx().map(r => { let sc = 0;
    if (n && r.s.id === n) sc += 100;
    if (nq.length >= 2 && r.phrases.some(p => p === nq)) sc += 80; else if (nq.length >= 3 && r.phrases.some(p => p.includes(nq) || (p.length >= 3 && nq.includes(p) && /\s/.test(p + ' ')))) sc += 40;
    if (qt.length) { const hs = qt.filter(w => r.strong.has(w)).length, ht = qt.filter(w => r.text.has(w)).length;
      if (hs >= Math.ceil(qt.length * 0.6)) sc += 20 * hs / qt.length; else if (ht >= Math.ceil(qt.length * 0.8)) sc += 5 * ht / qt.length; }
    return {s: r.s, score: sc}; }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
}
function viewSearch(q = '') {
  view.innerHTML = `<form class="searchbox" role="search" onsubmit="return false"><span class="sico">${ICON.search}</span><input id="q" type="search" enterkeyhint="search" autocomplete="off" value="${esc(q)}" placeholder="Search the demo items" aria-label="Search the demo items"><button type="button" id="clr" aria-label="Clear">✕</button></form>
  <div class="chips" id="ex"></div><div id="results" aria-live="polite"></div>`;
  const input = $('#q'), out = $('#results');
  const run = () => { const v = input.value.trim(); lastQuery = v;
    history.replaceState(null, '', '#/search' + (v ? '?q=' + encodeURIComponent(v) : ''));
    $('#ex').innerHTML = v ? '' : EXAMPLES.map(c => `<button type="button" class="chip">${esc(c)}</button>`).join('');
    view.querySelectorAll('#ex .chip').forEach(b => b.onclick = () => { input.value = b.textContent; run(); });
    if (!v) { out.innerHTML = `<p class="muted small">Demo search covers only the ${D.sections.length} demo items (sample charge cards and patrol cards), on your device and offline. Full-text search of every code is in the full version.</p>`; return; }
    const rs = searchDemo(v);
    out.innerHTML = rs.length ? `<h3 class="grouph">Demo results <span class="muted small">(${rs.length})</span></h3>${rs.map(r => itemRes(r.s)).join('')}`
      : `<div class="card" id="noDemo"><p>No matches in the demo items.</p><p class="small muted">${LOCK} Search across every code is available in the full version. ${CTA}.</p></div>`; };
  let t; input.oninput = () => { clearTimeout(t); t = setTimeout(run, 150); };
  $('#clr').onclick = () => { input.value = ''; run(); input.focus(); };
  run();
}

// ---- calculators ----
const CALC = {possess: {sub: 'G:1', amount: '', unit: 'g'}};   // in memory only
const seg = (k, label, opts, st) => `<div class="field"><div class="flabel">${label}</div><div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button type="button" data-k="${k}" data-v="${v}" class="${String(st[k]) === String(v) ? 'on' : ''}" aria-pressed="${String(st[k]) === String(v)}">${t}</button>`).join('')}</div></div>`;
const LOCKED_CALCS = ['Enhancement (repeat offenders)', 'Theft', 'Assault', 'Criminal mischief', 'DWI', 'Drug delivery and drug-free zones', 'Punishment ranges'];
function viewCalcHub() {
  view.innerHTML = `<h2 class="ph">Calculators</h2><div class="hub"><a class="hubi" href="#/calc/possess"><span class="tico">${ICON.HS}</span><span><span class="tt">Drug possession (demo)</span><span class="ts">Penalty Group 1 / 1-B and marihuana, by amount</span></span></a></div>
  <div class="card list">${LOCKED_CALCS.map(l => lockedRow(l)).join('')}</div>
  <p class="src">Tiers are read from the official statute text at build time. Calculator inputs stay in memory only.</p>`;
}
const groupOf = st => st.sub.startsWith('G:') ? st.sub.slice(2) : D.calc.substances.find(x => x.name === st.sub)?.group;
function resultHTML(r) {
  if (r.error) return `<div class="card result" id="calcOut"><h4>Result</h4><p>${esc(r.error)}</p></div>`;
  return `<div class="card result" id="calcOut"><h4>Result</h4><div class="rhead">${badge(r.grade)}<div class="rlabel">${esc(r.label)}</div></div>
  ${r.range ? `<div class="range">${esc(r.range)}</div>` : ''}${r.bounds ? `<div class="small muted">Tier: ${esc(r.bounds)}</div>` : ''}
  ${arrestHTML(r.arrest)}
  <h4 style="margin-top:14px">Steps</h4><ol class="steps">${r.steps.map(s => `<li>${esc(s.t)} ${citeLink(s.cite)}</li>`).join('')}</ol>
  ${r.caveats.length ? `<div class="caveats"><b>⚠ Caveats: facts or law the app can't decide</b><ul>${r.caveats.map(c => `<li>${esc(c.t)} ${citeLink(c.cite)}</li>`).join('')}</ul></div>` : ''}
  <p class="small muted">Tiers read from the official text at build time. Inputs stay in memory on this screen only: not saved, not in the URL. Drug-free zones and delivery are in the full version.</p></div>`;
}
function viewPossess() {
  const st = CALC.possess, C = D.calc;
  const draw = () => { const g = groupOf(st), sec = C.possess[g], s = C.substances.find(x => x.name === st.sub);
    view.innerHTML = `<a class="backlink" href="#/calc">← Calculators</a><div class="card"><h2 class="ph">${ICON.HS} Drug possession (demo)</h2>
    <p class="small muted">Demo: possession only, ${Object.values(C.possess).filter((v, i, a) => a.indexOf(v) === i).map(x => esc(citeOf('HS', x))).join(' and ')}.</p>
    <form class="cform" onsubmit="return false" autocomplete="off">
    <div class="field"><label class="flabel" for="dsub">Substance or penalty group</label><select id="dsub" class="sel">
    <optgroup label="Substance (listed in the penalty-group text)">${C.substances.map(x => `<option value="${esc(x.name)}" ${st.sub === x.name ? 'selected' : ''}>${esc(x.name)} (PG ${esc(x.group)})</option>`).join('')}</optgroup>
    <optgroup label="Choose directly">${Object.keys(C.possess).map(k => `<option value="G:${k}" ${st.sub === 'G:' + k ? 'selected' : ''}>${k === 'MJ' ? 'Marihuana' : 'Penalty Group ' + esc(k)} (${esc(citeOf('HS', C.possess[k]))})</option>`).join('')}</optgroup></select></div>
    ${s ? `<div class="small muted subq">Listed in ${esc(citeOf('HS', s.sec) + s.path)}: “${esc(s.quote)}”</div>` : ''}
    <div class="field"><label class="flabel" for="damt">Amount</label><div class="calc"><input id="damt" inputmode="decimal" autocomplete="off" value="${esc(st.amount)}" placeholder="0" aria-label="Amount"></div></div>
    ${seg('unit', 'Unit', [['g', 'grams'], ['oz', 'ounces'], ['lb', 'pounds']], st)}
    <div class="lockrow small muted">${LOCK} Delivery, other penalty groups and drug-free zones: full version</div></form></div><div id="calcRes"></div>`;
    const upd = () => { $('#calcRes').innerHTML = Number(st.amount) > 0 ? resultHTML(calcPossess(C, {group: groupOf(st), amount: st.amount, unit: st.unit})) : `<div class="card muted small" id="calcOut">Enter an amount to see the grade.</div>`; };
    view.querySelectorAll('.seg button[data-k]').forEach(b => b.onclick = () => { st[b.dataset.k] = b.dataset.v; draw(); });
    $('#dsub').onchange = e => { st.sub = e.target.value; draw(); };
    $('#damt').oninput = e => { st.amount = e.target.value.replace(/,/g, ''); upd(); };
    upd(); void sec; };
  draw();
}

// ---- disclaimer, settings ----
const ACK_VERSION = 1;
const DISCLAIMER_HTML = `<p><b>Reference only, not legal advice.</b> This app is a quick-reference tool for Texas statutes. It is not legal advice and does not create an attorney-client relationship.</p>
  <p>Always verify against the official statute. Follow your department's policies and the guidance of your District Attorney's office; they control over anything shown here.</p>
  <p>Summaries, patrol cards and calculators can be incomplete or out of date. The official text controls.</p>`;
function showDisclaimer() {
  if (LS.get('ack', 0) === ACK_VERSION) return;
  const d = document.createElement('div'); d.className = 'modalwrap'; d.id = 'ackModal';
  d.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ackT"><div class="kicker">Before you start · demo</div><h2 id="ackT">Disclaimer</h2>${DISCLAIMER_HTML}
  <label class="chk"><input type="checkbox" id="ackChk"> I understand this is a reference tool, not legal advice.</label>
  <button class="btn" id="ackBtn" disabled>Continue</button><p class="small muted">Only the fact that you acknowledged is saved on this device.</p></div>`;
  document.body.appendChild(d); document.body.classList.add('locked');
  const c = d.querySelector('#ackChk'), b = d.querySelector('#ackBtn');
  c.onchange = () => { b.disabled = !c.checked; }; b.onclick = () => { LS.set('ack', ACK_VERSION); d.remove(); document.body.classList.remove('locked'); $('#view').focus(); };
  setTimeout(() => c.focus(), 0);
}
async function viewSettings() {
  let ver = null; try { ver = await (await fetch('data/version.json')).json(); } catch {}
  const ready = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  view.innerHTML = `<h2 class="ph">Settings</h2>
  <div class="card"><h4>Appearance</h4><div class="seg" role="group" aria-label="Theme">${['light', 'dark'].map(t => `<button type="button" data-theme="${t}" class="${document.documentElement.dataset.theme === t ? 'on' : ''}" aria-pressed="${document.documentElement.dataset.theme === t}">${t === 'light' ? 'Light' : 'Dark'}</button>`).join('')}</div></div>
  <div class="card" id="offCard"><h4>${ICON.offline} Offline</h4><p class="small">${ready ? '<b>Ready offline.</b> The demo app and its sample items are saved on this device.' : 'Setting up the offline copy…'}</p>
    <div class="kv small"><span>Law text fetched</span><b>${esc(ver?.fetched || D.fetched)}</b><span>Demo version</span><b><code>${esc(ver?.version || '–')}</code></b></div></div>
  <div class="card list">${lockedRow('Download all codes for offline')}${lockedRow('Favorites and recently viewed')}</div>
  <div class="card" id="discCard"><h4>Disclaimer</h4>${DISCLAIMER_HTML}<p class="small muted">${LS.get('ack', 0) === ACK_VERSION ? 'You acknowledged this disclaimer on this device.' : 'Not yet acknowledged.'}</p></div>
  <div class="card"><h4>About this demo</h4><p class="small">A limited demo with sample content only. Stored on this device: the theme and that you acknowledged the disclaimer. No accounts, no searches or calculator inputs saved, nothing sent anywhere.</p><p class="small"><b>${CTA}.</b></p></div>
  <p class="src">TX Law Quick Ref (demo). Source: Texas Legislature, statutes.capitol.texas.gov. Not affiliated with any agency.</p>`;
  view.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { setTheme(b.dataset.theme); viewSettings(); });
}

// ---- router ----
const TABS = {'': 'home', search: 'search', calc: 'calc', saved: 'saved', settings: 'settings'};
const LOCKED_WHAT = {browse: 'Browsing the full Penal Code', c: 'Browsing the full Penal Code', ccp: 'The “What can I do?” patrol guide', law: 'Case law',
  saved: 'Favorites and recently viewed', punish: 'Punishment ranges for every grade', arl: 'City ordinances', dwi: 'DWI tools', d: 'Statutory definitions', terms: 'Terms of use', privacy: 'Privacy details', locked: 'This feature'};
let routeTok = 0;
async function route() {
  const h = location.hash.slice(1) || '/'; const [path, qs] = h.split('?'); const parts = path.split('/').filter(Boolean).map(decodeURIComponent); const P = new URLSearchParams(qs || '');
  const p0 = parts[0] || '', tab = TABS[p0] || '', my = ++routeTok;
  document.querySelectorAll('.tabs a').forEach(a => { const on = a.dataset.tab === tab; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  try {
    await load(); if (my !== routeTok) return;
    if (!p0) viewHome();
    else if (p0 === 'search') viewSearch(P.get('q') || '');
    else if (p0 === 's') viewSection('PE', parts[1] || '');
    else if (p0 === 'x') CODES[parts[1]] ? viewSection(parts[1], parts[2] || '') : viewHome();
    else if (p0 === 'code') viewLocked(`The full ${CODES[parts[1]]?.name || 'code'}`);
    else if (p0 === 'calc') !parts[1] ? viewCalcHub() : parts[1] === 'possess' ? viewPossess() : viewLocked('This calculator');
    else if (p0 === 'settings') await viewSettings();
    else if (LOCKED_WHAT[p0]) viewLocked(LOCKED_WHAT[p0]);
    else viewHome();
  } catch (e) { if (my === routeTok) view.innerHTML = `<div class="card">Could not load data: ${esc(e.message)}. Check your connection and try again.</div>`; }
  if (my === routeTok) { view.classList.remove('fade'); void view.offsetWidth; view.classList.add('fade'); }
  if (p0 !== 'search') window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route); route(); showDisclaimer();

// ---- offline: same update policy as the full app (new version applied when ready, unless a calculator is open) ----
(async () => {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller; let reloading = false, applied = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if ((hadController || applied) && !reloading) { reloading = true; location.reload(); } });
  const reg = await navigator.serviceWorker.register('sw.js').catch(() => null); if (!reg) return;
  const onWaiting = w => { const apply = () => { applied = true; w.postMessage('SKIP_WAITING'); };
    if (/^#\/calc\/./.test(location.hash)) { if ($('#updBanner')) return; const b = document.createElement('div'); b.id = 'updBanner'; b.className = 'updbanner'; b.setAttribute('role', 'status');
      b.innerHTML = '<span>An update is ready.</span><button class="btn" type="button">Reload</button>'; b.querySelector('button').onclick = apply; document.body.appendChild(b); } else apply(); };
  if (reg.waiting && hadController) onWaiting(reg.waiting);
  reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) onWaiting(w); }); });
  const check = () => reg.update().catch(() => {}); check();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();

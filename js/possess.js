// DEMO possession calculator (H&S 481.115 and 481.121 only). A trimmed copy of the possession path of the full app's drug calculator:
// weight/tier lookup, punishment range and the CCP 14.06 citation check, over data/demo.json `calc`, which holds only
// the tiers of the demo sections. No delivery, no other penalty groups, no drug-free-zone rules ship in the demo.
export const GL = {F1:'1st-degree felony',F2:'2nd-degree felony',F3:'3rd-degree felony',SJF:'State jail felony',A:'Class A misdemeanor',B:'Class B misdemeanor',C:'Class C misdemeanor'};
const fmt$ = n => '$' + Number(n).toLocaleString('en-US');
const qtext = q => q ? `${q.v.toLocaleString('en-US')} ${q.u === 'units' ? 'abuse units' : q.u}` : '';
const toBase = (D, v, u) => Number(v) * D.unitG[u];
export function findTier(D, sec, amt, unit) {
  const tiers = D.sections[sec].tiers, units = tiers.some(t => (t.lo || t.hi).u === 'units');
  if (units !== (unit === 'units')) return {error: units ? 'This penalty group is graded by number of abuse units.' : 'This offense is graded by weight (g, oz, lb), not abuse units.'};
  const x = toBase(D, amt, unit), eps = 1e-9 * Math.max(1, x);
  const ok = t => t.remun === undefined &&
    (!t.lo || (t.loInc ? x >= toBase(D, t.lo.v, t.lo.u) - eps : x > toBase(D, t.lo.v, t.lo.u) + eps)) &&
    (!t.hi || (t.hiInc ? x <= toBase(D, t.hi.v, t.hi.u) + eps : x < toBase(D, t.hi.v, t.hi.u) - eps));
  return {tier: tiers.find(ok)};
}
export function rangeOf(D, g, special) {
  if (special) return `TDCJ life or ${special.min} to ${special.max} years; fine up to ${fmt$(special.fine)}`;
  const p = D.punishments[g]; if (!p) return '';
  if (g === 'C') return `Fine up to ${fmt$(p.fineMax)} (PC ${p.section})`;
  if (p.confinement === 'jail') return `Jail up to ${p.jailMax} and/or fine up to ${fmt$(p.fineMax)} (PC ${p.section})`;
  return `${p.confinement === 'TDCJ' ? 'TDCJ' : 'State jail'} ${p.prisonMin} to ${p.prisonMax}${p.life ? ' or life' : ''}; optional fine up to ${fmt$(p.fineMax)} (PC ${p.section})`;
}
// i = {group, amount, unit:'g'|'oz'|'lb'}
export function calcPossess(D, i) {
  const steps = [], cav = []; const sec = D.possess[i.group];
  if (!sec || !D.sections[sec]) return {error: 'Not in this demo.'};
  const S = D.sections[sec]; steps.push({t: `${S.title}`, cite: `HS ${sec}`});
  if (!(Number(i.amount) > 0)) return {error: 'Enter an amount greater than zero.', sec, steps};
  const {tier, error} = findTier(D, sec, i.amount, i.unit);
  if (error || !tier) return {error: error || 'No tier matched.', sec, steps};
  steps.push({t: `${Number(i.amount).toLocaleString('en-US')} ${i.unit} falls in "${tier.text}" → ${GL[tier.grade]}`, cite: `HS ${sec}${tier.path}`});
  if (!i.group.startsWith('MJ')) cav.push({t: 'Weight is aggregate weight including adulterants or dilutants, as the section states.', cite: `HS ${sec}`});
  const g = tier.grade; let arrest;
  const d = D.d1406 && D.d1406[`HS ${sec}`];
  if (['F1', 'F2', 'F3', 'SJF'].includes(g)) arrest = {kind: 'arrest', t: 'Felony: no citation option (CCP 14.06 covers only misdemeanors).', cites: [['CR', '14.06', '(c)']]};
  else if (d && (!d.subs || d.subs.includes(tier.path))) arrest = {kind: 'citation', t: 'Class A/B listed in CCP 14.06(d): a citation may be issued instead of taking the person before a magistrate if the person resides in the county.', cites: [['CR', '14.06', '(c)'], ['CR', '14.06', d.item]]};
  else arrest = {kind: 'arrest', t: 'Not on the CCP 14.06(d) list: no citation-in-lieu option.', cites: [['CR', '14.06', '(d)']]};
  return {sec, title: S.title, tier, grade: g, label: GL[g], range: rangeOf(D, g, tier.special), steps, caveats: cav, arrest,
          bounds: `${qtext(tier.lo)}${tier.lo ? (tier.loInc ? ' ≤ ' : ' < ') : ''}amount${tier.hi ? (tier.hiInc ? ' ≤ ' : ' < ') + qtext(tier.hi) : ''}`};
}

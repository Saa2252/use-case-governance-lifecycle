/* ============================================================================
   Ava Use Case Governance Lifecycle — application logic
   No framework, no build step, no network calls. State persists to localStorage.
   ========================================================================= */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KEY = 'ucgl-v2'; // bumped from v1 so a stale blank-mode save never leaks back in
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function today() { return new Date().toISOString().slice(0, 10); }

/* ------------------------------------------------------------------ state */

let state;

// Whether the visitor has manually opened the (normally collapsed) Article 5
// screen. Deliberately NOT part of `state` — it's a UI preference, not part
// of the governance record, and shouldn't round-trip through the exported
// approval record. Tracked separately so that clicking a Yes/No toggle
// inside it (which re-renders the whole gate) doesn't snap it shut again.
let prohOpen = false;

// The record always starts as Ava at first pass. There is no blank mode —
// this is a single worked example, not a general-purpose risk calculator.
function avaState() {
  const s = {
    gate: 1, regs: false,
    intake: { ...AVA.intake },
    risk: { ...AVA.risk },
    controls: JSON.parse(JSON.stringify(AVA.controlsFirstPass)),
    evidence: {}, // arrives later in the story, at gate 4
    conditions: {},
    signatures: JSON.parse(JSON.stringify(AVA.signatures)),
    monitoring: { metrics: [], incident: '', modelChange: '', review: '', retire: '' },
    log: [], conditionsApplied: false, recheck: null
  };
  s.log = [
    { t: '2026-08-05', k: 'pass', m: '<b>Gate 1 — What is it?</b> Intake completed. Four tool permissions declared, including fee reversal.' },
    { t: '2026-08-12', k: '',     m: '<b>Supplier terms</b> reviewed by Legal. No-training clause confirmed at §7.3.' },
    { t: '2026-08-21', k: '',     m: '<b>Kill switch drill</b> run. Ava disabled in 1m 48s by Ops on-call.' },
    { t: '2026-08-19', k: 'pass', m: '<b>Gate 2 — How much could go wrong?</b> Assessed <b>Tier 1 — High</b>. Escalation rule fired: untrusted member text reaches a model holding write access to money.' },
    { t: '2026-09-02', k: 'fail', m: '<b>Gate 3 — What must be true before launch? NOT PASSED.</b> Two required controls not in place: human approval above a money threshold, and a financial action register. Launch date held.' }
  ].sort((a, b) => a.t.localeCompare(b.t));
  s.gate = 1;
  return s;
}

function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
function load() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {}
  return null;
}

function log(kind, msg, date) {
  state.log.push({ t: date || today(), k: kind, m: msg });
}

/* ------------------------------------------------------- risk computation */

function riskAnswers() {
  const a = { ...state.risk };
  a.users_public = state.intake.users === 'Anyone on the public site';
  return a;
}

// Tier cutoffs (TIER1_AVG_SEVERITY, TIER3_AVG_SEVERITY) live in data.js next
// to TIERS — they're a policy decision, not rendering logic.
function tierFromAverage(avg) {
  return avg >= TIER1_AVG_SEVERITY ? 1 : avg >= TIER3_AVG_SEVERITY ? 2 : 3;
}

function assessRisk() {
  const a = state.risk;
  const answered = RISK_QUESTIONS.every(q => typeof a[q.id] === 'number');
  if (!answered) return null;

  const totalWeight = RISK_QUESTIONS.reduce((n, q) => n + q.weight, 0);
  const raw = RISK_QUESTIONS.reduce((n, q) => n + q.weight * a[q.id], 0);
  const max = totalWeight * 3;
  const avg = raw / totalWeight; // weighted average severity, 0-3 scale

  // Arithmetic gives a starting position; escalation rules can only move it up.
  let tier = tierFromAverage(avg);
  const base = tier;

  const fired = ESCALATIONS.filter(e => e.test(a));
  fired.forEach(e => { if (e.floor < tier) tier = e.floor; });

  return { tier, raw, max, avg, fired, base };
}

function requiredControls() {
  const r = assessRisk();
  if (!r) return [];
  const a = riskAnswers();
  return CONTROLS.filter(c => c.req(a, r.tier));
}

/* ------------------------------------------------------- gate status ---- */

// A "yes" on any Article 5 screen is a stop, not a higher tier — distinct
// enough from the rest of gate 1 that it gets its own check rather than
// being folded into the ordinary required-fields test below.
function prohibitedFlagged() {
  const p = state.intake.prohibited || {};
  return PROHIBITED_CHECKS.some(c => p[c.id] === true);
}

function gateStatus(n) {
  const r = assessRisk();
  const req = requiredControls();

  if (n === 1) {
    if (prohibitedFlagged()) return 'fail';
    const need = ['name', 'purpose', 'owner', 'users'];
    const ok = need.every(k => state.intake[k]) && (state.intake.tools || []).length > 0 &&
      PROHIBITED_CHECKS.every(c => typeof (state.intake.prohibited || {})[c.id] === 'boolean');
    return ok ? 'done' : 'open';
  }
  if (n === 2) return r ? 'done' : 'open';
  if (n === 3) {
    if (!r) return 'open';
    const st = req.map(c => (state.controls[c.id] || {}).status);
    if (st.some(s => s === 'no')) return 'fail';
    if (st.some(s => !s)) return 'open';
    return Object.keys(state.conditions).length ? 'cond' : 'done';
  }
  if (n === 4) {
    if (gateStatus(3) === 'open') return 'open';
    const live = req.filter(c => (state.controls[c.id] || {}).status !== 'na');
    if (!live.length) return 'open';
    const missing = live.filter(c => !(state.evidence[c.id] || []).length);
    if (missing.length === live.length) return 'open';
    return missing.length ? 'fail' : 'done';
  }
  if (n === 5) {
    const signed = Object.values(state.signatures).filter(s => s.date).length;
    if (signed === 3) return 'done';
    return signed ? 'open' : 'open';
  }
  if (n === 6) {
    const m = state.monitoring;
    return (m.metrics || []).length && m.incident && m.review ? 'done' : 'open';
  }
}

function approvalBlockers() {
  const out = [];
  const g1 = gateStatus(1);
  if (g1 === 'fail') out.push('Gate 1 has flagged an Article 5 prohibited practice — this cannot proceed to approval under any control set.');
  else if (g1 !== 'done') out.push('Gate 1 intake is incomplete.');
  if (gateStatus(2) !== 'done') out.push('Gate 2 risk tier has not been assigned.');
  const g3 = gateStatus(3);
  if (g3 === 'fail') out.push('Gate 3 has required controls that are not in place.');
  if (g3 === 'open') out.push('Gate 3 controls have not all been assessed.');
  if (gateStatus(4) !== 'done') out.push('Gate 4 evidence is missing for one or more required controls.');
  return out;
}

/* ----------------------------------------------------------- rendering -- */

function render() {
  renderRail();
  renderTier();
  renderStage();
  renderLog();
  $('#regtoggle').checked = state.regs;
  save();
}

function renderRail() {
  const cls = { done: 'done', fail: 'fail', cond: 'cond', open: '' };
  $('#railList').innerHTML = GATES.map(g => {
    const st = gateStatus(g.n);
    const mark = st === 'done' ? '✓' : st === 'fail' ? '!' : st === 'cond' ? '~' : g.n;
    return `<li class="railitem ${state.gate === g.n ? 'cur' : ''}" data-gate="${g.n}">
      <span class="rnum ${cls[st]}">${mark}</span>
      <span><span class="rtitle">${esc(g.client)}</span><span class="rformal">${esc(g.formal)}</span></span>
    </li>`;
  }).join('');
  $$('.railitem').forEach(el => el.onclick = () => { state.gate = +el.dataset.gate; render(); window.scrollTo(0, 0); });
}

function renderTier() {
  const r = assessRisk();
  const box = $('#tierBox');
  box.className = 'tierbox' + (r ? ' ' + TIERS[r.tier].klass : '');
  $('#tierName').textContent = r ? TIERS[r.tier].name : 'Not yet assessed';
}

function renderLog() {
  const el = $('#logList');
  if (!state.log.length) { el.innerHTML = '<li class="empty">Nothing recorded yet.</li>'; return; }
  const sorted = [...state.log].sort((a, b) => a.t.localeCompare(b.t));
  el.innerHTML = sorted.map(e =>
    `<li class="ev-${e.k || 'plain'}"><span class="lt">${fmt(e.t)}</span><div class="lm">${e.m}</div></li>`
  ).join('');
}

function gateHead(g) {
  return `<div class="gatehead">
    <div class="gn">Gate ${g.n} · ${esc(g.formal)}</div>
    <h2>${esc(g.client)}</h2>
    <p class="gq">${esc(g.question)}</p>
    <div class="meta">
      <span class="chip"><b>${esc(g.time)}</b></span>
      <span class="chip">In the room: ${g.room.map(esc).join(' · ')}</span>
    </div>
  </div>`;
}

function navRow(msg) {
  const prev = state.gate > 1 ? `<button class="ghost" data-nav="${state.gate - 1}">← Gate ${state.gate - 1}</button>` : '';
  const next = state.gate < 6 ? `<button class="primary" data-nav="${state.gate + 1}">Gate ${state.gate + 1}: ${esc(GATES[state.gate].client)} →</button>` : '';
  return `<div class="navrow">${prev}${next}<span class="spacer"></span>${msg ? `<span class="blockmsg">${msg}</span>` : ''}</div>`;
}

function renderStage() {
  const g = GATES[state.gate - 1];
  const fn = [g1, g2, g3, g4, g5, g6][state.gate - 1];
  $('#stage').innerHTML = gateHead(g) + fn();
  wire();
}

/* --------------------------------------------------------------- gate 1 - */

function g1() {
  const v = state.intake;
  const fields = INTAKE_FIELDS.map(f => {
    const val = v[f.id] || (f.type === 'multi' ? [] : '');
    let input;
    if (f.type === 'textarea') input = `<textarea data-in="${f.id}">${esc(val)}</textarea>`;
    else if (f.type === 'select')
      input = `<select data-in="${f.id}"><option value="">Choose…</option>` +
        f.options.map(o => `<option ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('') + `</select>`;
    else if (f.type === 'multi')
      input = `<div class="checks">` + f.options.map(o =>
        `<label><input type="checkbox" data-multi="${f.id}" value="${esc(o)}" ${val.includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`
      ).join('') + `</div>`;
    else input = `<input type="text" data-in="${f.id}" value="${esc(val)}">`;
    return `<div class="f"><label class="lab">${esc(f.label)}</label>${f.hint ? `<p class="fh">${esc(f.hint)}</p>` : ''}${input}</div>`;
  }).join('');

  const reg = state.regs ? `<div class="regpanel"><h3>Why this gate exists in the frameworks</h3>
    <p>NIST AI RMF puts this in <strong>MAP</strong> — you cannot manage a risk you have not described. MAP 1.1 asks for intended purpose and context; MAP 2.1 asks for the specific tasks the system performs. The tool permission list is the part most intake forms miss, and it is the part that makes an agent different from a model.</p>
    <p>Under the EU AI Act, this is the evidence base for the classification decision under <strong>Article 6</strong>. You cannot argue you are outside Annex III unless you have written down what the thing actually does.</p></div>` : '';

  const p = v.prohibited || {};
  const flagged = prohibitedFlagged();
  const flaggedChecks = PROHIBITED_CHECKS.filter(c => p[c.id] === true);

  const prohibitedStop = flagged ? `<div class="banner stop">
    <h3>Article 5 prohibited practice flagged — stop here</h3>
    <p>This is not a higher risk tier. Under the EU AI Act, the practice below is not permitted to place on the market or put into service in the EU, subject only to narrow statutory exceptions. No control set at gate 3 makes this approvable. Nothing past this point should be built until legal gives a written answer.</p>
    <ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--ink2)">${flaggedChecks.map(c =>
      `<li><b>${esc(c.article)}</b> — ${esc(c.q)}</li>`).join('')}</ul>
  </div>` : '';

  // Collapsed by default so a clean pass (the ordinary case) doesn't cost a
  // skimming reviewer eight rows of scroll — but never collapsed while
  // something is actually flagged, and stays open once a visitor opens it
  // manually (see prohOpen above).
  const isOpen = flagged || prohOpen;
  const summaryLabel = flagged
    ? `${flaggedChecks.length} of ${PROHIBITED_CHECKS.length} flagged`
    : `all ${PROHIBITED_CHECKS.length} cleared`;
  const summaryColor = flagged ? 'var(--bad)' : 'var(--ok)';

  const prohibitedCard = `<details class="card prohdetails" ${isOpen ? 'open' : ''}>
    <summary>Before anything else: Article 5 screen
      <span class="prohsummary" style="color:${summaryColor}">${esc(summaryLabel)}</span>
    </summary>
    <div class="prohbody">
      <p class="hint">${PROHIBITED_CHECKS.length} questions. Most systems clear all ${PROHIBITED_CHECKS.length} in under a minute — the point is not thoroughness, it is catching the rare one that was never going to be approvable, before time is spent tiering it. A "yes" is not "add more controls". It is "stop".</p>
      ${PROHIBITED_CHECKS.map(c => {
        const ans = p[c.id];
        return `<div class="prohcheck">
          <span class="q">${esc(c.q)}</span><span class="art">${esc(c.article)}</span>
          <div class="states">
            <button data-proh="${c.id}" data-s="clear" class="${ans === false ? 'on' : ''}">No</button>
            <button data-proh="${c.id}" data-s="flag" class="${ans === true ? 'on' : ''}">Yes</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </details>`;

  return reg + prohibitedStop + prohibitedCard + `<div class="card"><h3>Intake</h3>
    <p class="hint">Answer as if writing for someone who joins the review halfway through and has no context.</p>
    ${fields}</div>` + navRow();
}

/* --------------------------------------------------------------- gate 2 - */

function g2() {
  const sev = ['Low', 'Moderate', 'High', 'Severe'];
  const qs = RISK_QUESTIONS.map(q => {
    const cur = state.risk[q.id];
    const wtag = q.weight === 2 ? ` <span class="wtag" title="${esc(q.weightWhy)}">weighted ×2</span>` : '';
    return `<div class="rq"><span class="lab">${esc(q.label)}${wtag}</span><p class="why">${esc(q.why)}</p>
      <div class="opts">${q.options.map((o, i) =>
        `<label class="opt ${cur === i ? 'sel' : ''}">
           <input type="radio" name="rq-${q.id}" data-risk="${q.id}" value="${i}" ${cur === i ? 'checked' : ''}>
           <span>${esc(o)}</span><span class="sev">${sev[i]}</span></label>`
      ).join('')}</div></div>`;
  }).join('');

  const r = assessRisk();
  let verdict = '';
  if (r) {
    const t = TIERS[r.tier];
    const moved = r.fired.length && r.tier < r.base;
    verdict = `<div class="verdict ${t.klass}">
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.means)}</p>
      <p style="font-size:13px">Weighted exposure ${r.raw} of ${r.max} — average severity <b>${r.avg.toFixed(1)} of 3</b>. Tier 1 begins at High (${TIER1_AVG_SEVERITY.toFixed(1)}) on average; Tier 3 requires staying under Moderate (${TIER3_AVG_SEVERITY.toFixed(1)})${moved ? `. On that average alone this would be ${esc(TIERS[r.base].name)} — it was escalated because of the combinations below.` : '.'}</p>
      ${r.fired.length ? `<ul>${r.fired.map(e =>
        `<li><b>Tier ${e.floor} floor:</b> ${esc(e.say)}</li>`).join('')}</ul>`
        : '<p style="font-size:13px;margin:0">No escalation rules fired. The tier comes from the answers alone.</p>'}
    </div>`;
  }

  const reg = state.regs ? `<div class="regpanel"><h3>Where the tier comes from</h3>
    <p>NIST AI RMF <strong>GOVERN 1.3</strong> asks organisations to determine the level of risk management activity based on risk tolerance — which is exactly what a tier is. <strong>MAP 5.1</strong> covers likelihood and magnitude of impact.</p>
    <p>${REG_NOTE.disclaimer}</p>
    <p>${REG_NOTE.annex3}</p>
    <p>${REG_NOTE.watch}</p></div>` : '';

  return reg + `<div class="card"><h3>Eight questions</h3>
    <p class="hint">Answer for what the system <em>can</em> do, not what you intend it to do. Governance follows the permission.</p>
    ${qs}</div>` + verdict + navRow();
}

/* --------------------------------------------------------------- gate 3 - */

function g3() {
  const r = assessRisk();
  if (!r) return `<div class="banner info"><h3>Finish gate 2 first</h3>
    <p>The required control set is generated from the risk answers. Without a tier there is nothing to require.</p></div>` + navRow();

  const req = requiredControls();
  const failing = req.filter(c => (state.controls[c.id] || {}).status === 'no');
  const undecided = req.filter(c => !(state.controls[c.id] || {}).status);
  const conds = Object.keys(state.conditions);

  let banner = '';
  if (failing.length) {
    const canApply = !state.conditionsApplied && failing.every(c => AVA.conditions[c.id]);
    banner = `<div class="banner stop">
      <h3>Gate 3 not passed — ${failing.length} required control${failing.length > 1 ? 's are' : ' is'} not in place</h3>
      <p>${failing.map(c => esc(c.name)).join(' · ')}</p>
      <p>This is the gate that stops things, and it is the reason the lifecycle is worth running. Ava was three weeks from launch with a fee reversal capability that no human ever saw and no register ever recorded. The board question — <em>how do we prove it was safe</em> — had no answer, because nothing was being written down.</p>
      <p>Two ways forward. Remove the capability, or attach launch conditions that make it defensible and hold the date until they are met. Northbridge chose conditions.</p>
      ${canApply ? `<button class="primary" data-act="applyconds">Attach launch conditions and re-run gate 3</button>` : ''}
    </div>`;
  } else if (conds.length) {
    banner = `<div class="banner go"><h3>Gate 3 passed with ${conds.length} condition${conds.length > 1 ? 's' : ''}</h3>
      <p>Conditions are commitments with an owner and a date, not intentions. They carry into the approval record and they are checked at gate 4. If a condition slips, the approval is not valid.</p></div>`;
  } else if (!undecided.length) {
    banner = `<div class="banner go"><h3>Gate 3 passed</h3><p>Every required control is in place.</p></div>`;
  }

  const groups = [...new Set(req.map(c => c.group))];
  const body = groups.map(gr => `<div class="cgroup">${esc(gr)}</div>` + req.filter(c => c.group === gr).map(c => {
    const s = state.controls[c.id] || {};
    const cond = state.conditions[c.id];
    const klass = s.status === 'no' ? 'bad' : cond ? 'cond' : s.status === 'yes' ? 'ok' : '';
    return `<div class="ctrl ${klass}">
      <div class="ctrl-top">
        <div><h4>${esc(c.name)}</h4><p class="plain">${esc(c.plain)}</p><p class="askq">Ask in the room: ${esc(c.ask)}</p></div>
        <div class="states">
          <button data-ctrl="${c.id}" data-s="yes" class="${s.status === 'yes' ? 'on' : ''}">In place</button>
          <button data-ctrl="${c.id}" data-s="no"  class="${s.status === 'no'  ? 'on' : ''}">Not in place</button>
          <button data-ctrl="${c.id}" data-s="na"  class="${s.status === 'na'  ? 'on' : ''}">N/A</button>
        </div>
      </div>
      <textarea data-note="${c.id}" placeholder="What is actually in place, or what is missing.">${esc(s.note || '')}</textarea>
      ${cond ? `<div class="condbox"><span class="cl">Launch condition</span>
        <p>${esc(cond.text)}</p>
        <div class="cmeta">Owner: ${esc(cond.owner)} · Due ${fmt(cond.due)}</div></div>` : ''}
      ${state.regs ? `<div class="regrow">${c.nist.map(t => `<span class="tag">NIST ${esc(t)}</span>`).join('')}
        ${c.eu.map(t => `<span class="tag eu">EU AI Act ${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('')).join('');

  const notReq = CONTROLS.filter(c => !req.includes(c));
  const notReqHtml = notReq.length ? `<div class="card" style="margin-top:18px">
    <h3>Not required at this tier</h3>
    <p class="hint">Recorded so the omission is a decision rather than an oversight. If the answers at gate 2 change, these come back.</p>
    <ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--ink2)">
      ${notReq.map(c => `<li>${esc(c.name)}</li>`).join('')}</ul></div>` : '';

  return banner + body + notReqHtml + navRow(
    failing.length ? 'You can move on, but gate 5 will stay locked.' : ''
  );
}

/* --------------------------------------------------------------- gate 4 - */

function g4() {
  const req = requiredControls().filter(c => (state.controls[c.id] || {}).status !== 'na');
  if (!req.length) return `<div class="banner info"><h3>Nothing to evidence yet</h3>
    <p>Work through gates 2 and 3 first.</p></div>` + navRow();

  const missing = req.filter(c => !(state.evidence[c.id] || []).length);
  const seedable = missing.length;

  const banner = missing.length
    ? `<div class="banner stop"><h3>${missing.length} control${missing.length > 1 ? 's have' : ' has'} no evidence</h3>
       <p>A control that nobody can point at is a claim. At this gate the reviewer asks for the artefact and writes down its date and its owner. Undated evidence is not evidence — it tells you nothing about whether the control survived the last release.</p>
       ${seedable ? `<button class="primary" data-act="seedev">Load the Northbridge evidence pack</button>` : ''}</div>`
    : `<div class="banner go"><h3>Evidence complete</h3>
       <p>Every required control has at least one dated artefact with a named owner. This set is what gets frozen at gate 5.</p></div>`;

  const body = req.map(c => {
    const items = state.evidence[c.id] || [];
    return `<div class="ev ${items.length ? '' : 'missing'}">
      <h4>${esc(c.name)}</h4>
      ${items.length ? `<ul>${items.map((e, i) =>
        `<li><span class="dt">${fmt(e.date)}</span><span>${esc(e.name)}</span><span class="ow">${esc(e.owner)}</span></li>`).join('')}</ul>`
        : `<p class="none">No artefact recorded.</p>`}
      <div class="evadd">
        <input type="text" data-ev="${c.id}" data-k="name" placeholder="Artefact — e.g. test report, config export, log sample">
        <input type="text" data-ev="${c.id}" data-k="owner" placeholder="Owner" style="max-width:130px">
        <button class="ghost" data-addev="${c.id}">Add</button>
      </div></div>`;
  }).join('');

  const reg = state.regs ? `<div class="regpanel"><h3>Why evidence is its own gate</h3>
    <p>NIST AI RMF <strong>MEASURE</strong> exists because MANAGE without MEASURE is a wish list. MEASURE 2.7 covers security and resilience testing — which is where the prompt injection results live. MEASURE 2.6 covers regular safety evaluation.</p>
    <p>If this system were ever classified high-risk, <strong>Article 11 and Annex IV</strong> would turn this gate from good practice into a filing obligation, and <strong>Article 12</strong> would set log retention. Building the habit before the obligation applies is cheaper than retrofitting it.</p></div>` : '';

  return reg + banner + body + navRow();
}

/* --------------------------------------------------------------- gate 5 - */

function g5() {
  const blockers = approvalBlockers();
  const r = assessRisk();

  const allSigned = Object.values(state.signatures).every(s => s.date);
  const nConds = Object.keys(state.conditions).length;

  const head = blockers.length
    ? `<div class="banner stop"><h3>Deployment blocked</h3>
       <p>Signatures are unavailable while any of the following is true. This is deliberate: an executive should never be asked to sign against an incomplete control set, because the signature is the thing that transfers accountability to them.</p>
       <ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--ink2)">${blockers.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`
    : allSigned
    ? `<div class="banner go"><h3>Approved${nConds ? ' with conditions' : ''} — cleared to deploy</h3>
       <p>Signed by ${Object.values(state.signatures).map(s => esc(s.name)).join(', ')} on ${fmt(Object.values(state.signatures)[0].date)}.
       ${r ? esc(TIERS[r.tier].name) : ''} · ${requiredControls().length} required controls${nConds ? `, ${nConds} under launch conditions` : ''}.</p>
       <p>The board question now has a one-page answer. Open the approval record to see it.</p></div>`
    : `<div class="banner go"><h3>Ready for signature</h3>
       <p>${r ? esc(TIERS[r.tier].name) : ''} · ${requiredControls().length} required controls, all in place${Object.keys(state.conditions).length ? `, ${Object.keys(state.conditions).length} under launch conditions` : ''} · evidence complete.</p>
       <p>What is being signed is a frozen set: this scope, these tool permissions, this model version, these controls. Anything outside it is a new decision, not a variation of this one.</p></div>`;

  const sigs = Object.entries(state.signatures).map(([k, s]) => `
    <div class="sig ${s.date ? 'signed' : ''}">
      <div class="who"><b>${esc(s.role)}</b><span>${esc(s.title || 'Title not set')}</span></div>
      <div>
        <input type="text" data-sig="${k}" data-k="name" value="${esc(s.name)}" placeholder="Name of the person signing" ${blockers.length ? 'disabled' : ''}>
      </div>
      <div>${s.date
        ? `<span class="stamp">Signed ${fmt(s.date)}</span> <button class="ghost" data-unsign="${k}">Withdraw</button>`
        : `<button class="ghost" data-sign="${k}" ${blockers.length ? 'disabled' : ''}>Sign</button>`}</div>
    </div>`).join('');

  const note = `<div class="card"><h3>Why one name, not a committee</h3>
    <p class="hint" style="margin:0">A committee approval means that when something goes wrong, the honest answer to “who decided this” is “the room”. The accountable executive line names a single person who carries the outcome, with risk and legal recorded as having reviewed rather than as co-owners. It is a harder conversation at the time and a much easier one afterwards.</p></div>`;

  const reg = state.regs ? `<div class="regpanel"><h3>Accountability in the frameworks</h3>
    <p>NIST AI RMF <strong>GOVERN 2.1</strong> asks for documented roles, responsibilities and lines of communication for AI risk. <strong>GOVERN 3.2</strong> covers human-AI configuration and oversight roles specifically.</p>
    <p>${REG_NOTE.applies}</p></div>` : '';

  return reg + head + sigs + note + navRow();
}

/* --------------------------------------------------------------- gate 6 - */

function g6() {
  const m = state.monitoring;
  const rows = (m.metrics || []).map((x, i) => `<tr>
    <td>${esc(x.name)}</td><td class="num">${esc(x.target)}</td><td>${esc(x.freq)}</td><td>${esc(x.act)}</td>
    <td><button class="ghost" data-delmetric="${i}" title="Remove">×</button></td></tr>`).join('');

  const table = (m.metrics || []).length
    ? `<div class="tblwrap"><table>
        <thead><tr><th>What is measured</th><th>Threshold</th><th>How often</th><th>What happens if it breaches</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<p class="hint">No metrics defined. Without them, gate 5 approved a snapshot of a system that will not stay still.</p>`;

  const addMetric = `<div class="evadd" style="margin-top:12px;flex-wrap:wrap">
    <input type="text" data-nm="name" placeholder="What is measured" style="min-width:180px">
    <input type="text" data-nm="target" placeholder="Threshold" style="max-width:120px">
    <input type="text" data-nm="freq" placeholder="How often" style="max-width:110px">
    <input type="text" data-nm="act" placeholder="What happens if it breaches" style="min-width:180px">
    <button class="ghost" data-act="addmetric">Add</button></div>`;

  const seedable = !(m.metrics || []).length;
  const seedBanner = seedable ? `<div class="banner info"><h3>The monitoring plan Northbridge agreed</h3>
    <p>Gate 5 approves a snapshot. Everything below is what turns that snapshot into something that stays true — and it is agreed before the executive signs, not after.</p>
    <button class="primary" data-act="seedmon">Load the Northbridge monitoring plan</button></div>` : '';

  const rc = state.recheck;
  const recheckPanel = rc
    ? `<div class="banner ${rc.done ? (rc.tierChanged ? 'stop' : 'go') : 'stop'}">
        <h3>${rc.done
          ? (rc.tierChanged ? 'Light re-check found a real change' : 'Light re-check complete')
          : 'Something changed underneath the approval — light re-check required'}</h3>
        <p>${rc.done ? rc.summary
          : 'The model version moved, or Ava\'s tool permissions changed — either one trips the same wire. This does not re-open the whole lifecycle — it re-opens gate 2 in light mode. Four questions, one reviewer, same day.'}</p>
        ${!rc.done ? `<ul style="margin:0 0 12px;padding-left:18px;font-size:13.5px;color:var(--ink2)">
          <li>Do the tool permissions still match what was approved?</li>
          <li>Did any answer at gate 2 change?</li>
          <li>Re-run the prompt injection suite against the change — same result?</li>
          <li>Re-run the threshold test — does it still stop at the configured number?</li>
        </ul><button class="primary" data-act="rechecked">Run the re-check</button>` : ''}
      </div>`
    : '';

  const reg = state.regs ? `<div class="regpanel"><h3>After deployment</h3>
    <p>NIST AI RMF <strong>MANAGE 4.1</strong> asks for post-deployment monitoring plans; <strong>MANAGE 2.4</strong> covers the ability to deactivate a system behaving outside intended use — the kill switch — and <strong>MANAGE 3.1</strong> covers ongoing monitoring of third-party components, which is where a supplier model change lands.</p>
    <p>${REG_NOTE.nist}</p></div>` : '';

  return reg + seedBanner + recheckPanel + `<div class="card"><h3>Metrics that would tell you it drifted</h3>
    <p class="hint">Each one needs a threshold and a consequence. A metric with no consequence is a chart.</p>${table}${addMetric}</div>

  <div class="card"><h3>The 2am path</h3>
    <p class="hint">Written for the person who is actually awake, not for the audit file.</p>
    <textarea data-mon="incident" placeholder="Who is paged, what they may do without escalating, when the regulator clock starts.">${esc(m.incident || '')}</textarea></div>

  <div class="card"><h3>Model change control</h3>
    <p class="hint">The most common way an approved AI system becomes an unapproved one is that nobody told governance something moved — the model version, or what it's allowed to do.</p>
    <textarea data-mon="modelChange" placeholder="What triggers a re-check, and how deep it goes.">${esc(m.modelChange || '')}</textarea>
    ${!rc ? `<div style="margin-top:12px"><button class="ghost" data-act="modelchange">Simulate: model version or tool permissions changed</button></div>` : ''}</div>

  <div class="card"><h3>Review and retirement</h3>
    <div class="f"><label class="lab">Next scheduled review</label>
      <input type="text" data-mon="review" value="${esc(m.review || '')}" placeholder="YYYY-MM-DD"></div>
    <div class="f"><label class="lab">What would make you turn it off?</label>
      <p class="fh">Systems without a retirement trigger do not get retired. They get quietly inherited.</p>
      <textarea data-mon="retire">${esc(m.retire || '')}</textarea></div></div>` + navRow();
}

/* ------------------------------------------------------------- wiring --- */

function wire() {
  $$('[data-nav]').forEach(b => b.onclick = () => { state.gate = +b.dataset.nav; render(); window.scrollTo(0, 0); });

  $$('[data-in]').forEach(el => el.onchange = () => { state.intake[el.dataset.in] = el.value; render(); });
  $$('[data-multi]').forEach(el => el.onchange = () => {
    const k = el.dataset.multi;
    const cur = new Set(state.intake[k] || []);
    el.checked ? cur.add(el.value) : cur.delete(el.value);
    state.intake[k] = [...cur];
    render();
  });

  $$('[data-proh]').forEach(b => b.onclick = () => {
    const id = b.dataset.proh, val = b.dataset.s === 'flag';
    const c = PROHIBITED_CHECKS.find(x => x.id === id);
    const was = (state.intake.prohibited || {})[id];
    // Always replace the object rather than mutate the existing one in
    // place — state.intake was a shallow spread of AVA.intake, so an
    // in-place write here would corrupt Ava's canonical source data for
    // every future fresh session in this same page load.
    state.intake.prohibited = { ...state.intake.prohibited, [id]: val };
    if (val && was !== true) log('fail', `<b>Article 5 flagged — ${esc(c.article)}.</b> ${esc(c.q)} Gate 1 cannot pass until this is cleared or legal confirms an exception in writing.`);
    if (!val && was === true) log('pass', `<b>${esc(c.article)} cleared.</b> No longer flagged.`);
    render();
  });

  $$('.prohdetails').forEach(d => d.ontoggle = () => { prohOpen = d.open; });

  $$('[data-risk]').forEach(el => el.onchange = () => {
    const before = assessRisk();
    state.risk[el.dataset.risk] = +el.value;
    const after = assessRisk();
    if (after && (!before || before.tier !== after.tier)) {
      log(after.tier === 1 ? 'fail' : 'pass',
        `<b>Gate 2 re-assessed.</b> Tier is now <b>${esc(TIERS[after.tier].name)}</b>. The required control set changed with it.`);
    }
    render();
  });

  $$('[data-ctrl]').forEach(b => b.onclick = () => {
    const id = b.dataset.ctrl, s = b.dataset.s;
    const c = CONTROLS.find(x => x.id === id);
    const prev = (state.controls[id] || {}).status;
    state.controls[id] = { ...(state.controls[id] || {}), status: prev === s ? undefined : s };
    if (s === 'no' && prev !== 'no') log('fail', `<b>${esc(c.name)}</b> marked not in place.`);
    if (s === 'yes' && prev === 'no') log('pass', `<b>${esc(c.name)}</b> now in place.`);
    render();
  });
  $$('[data-note]').forEach(el => el.onchange = () => {
    const id = el.dataset.note;
    state.controls[id] = { ...(state.controls[id] || {}), note: el.value };
    save();
  });

  $$('[data-addev]').forEach(b => b.onclick = () => {
    const id = b.dataset.addev;
    const name = $(`[data-ev="${id}"][data-k="name"]`).value.trim();
    const owner = $(`[data-ev="${id}"][data-k="owner"]`).value.trim();
    if (!name) return;
    (state.evidence[id] = state.evidence[id] || []).push({ name, owner: owner || 'Unassigned', date: today() });
    log('', `<b>Evidence added</b> for ${esc(CONTROLS.find(c => c.id === id).name)}: ${esc(name)}.`);
    render();
  });

  $$('[data-sig]').forEach(el => el.onchange = () => {
    state.signatures[el.dataset.sig].name = el.value; save();
  });
  $$('[data-sign]').forEach(b => b.onclick = () => {
    const k = b.dataset.sign, s = state.signatures[k];
    if (!s.name) {
      const inp = $(`[data-sig="${k}"]`);
      inp.focus();
      inp.placeholder = 'A signature needs a name — type it here first';
      return;
    }
    // Signs on the story's date, not the visitor's real one, so the decision
    // log stays in chronological order however long after launch someone clicks.
    const on = AVA.signDate;
    s.date = on;
    log('pass', `<b>${esc(s.role)}</b> signed: ${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''}.`, on);
    if (Object.values(state.signatures).every(x => x.date)) {
      log('pass', `<b>Gate 5 — Who signs? APPROVED.</b> Three signatures against a frozen control set. Deployment authorised.`, on);
    }
    render();
  });
  $$('[data-unsign]').forEach(b => b.onclick = () => {
    const k = b.dataset.unsign, s = state.signatures[k];
    s.date = '';
    log('fail', `<b>${esc(s.role)}</b> signature withdrawn. Approval is no longer complete.`);
    render();
  });

  $$('[data-mon]').forEach(el => el.onchange = () => { state.monitoring[el.dataset.mon] = el.value; render(); });

  $$('[data-delmetric]').forEach(b => b.onclick = () => {
    state.monitoring.metrics.splice(+b.dataset.delmetric, 1); render();
  });

  $$('[data-act]').forEach(b => b.onclick = () => actions[b.dataset.act]());
}

/* Story steps, written as functions over a state object so that both the
   buttons and the deep-link snapshots below go through the same code. */

function applyConditions(s) {
  Object.entries(AVA.conditions).forEach(([id, c]) => {
    s.conditions[id] = c;
    s.controls[id] = { status: 'yes', note: (s.controls[id] || {}).note };
  });
  s.conditionsApplied = true;
  s.log.push({ t: '2026-09-16', k: 'cond', m: `<b>Launch conditions attached.</b> Human approval threshold moved from prompt text into service configuration and lowered to $25, with a review queue between $25 and $50. A separate append-only reversal register added, which the agent credential cannot write to.` });
  s.log.push({ t: '2026-09-16', k: 'pass', m: `<b>Gate 3 — second pass. PASSED with 2 conditions.</b> Go-live held from 5 October to 2 November to build them.` });
}

function seedEvidence(s) {
  Object.entries(AVA.evidence).forEach(([id, items]) => { s.evidence[id] = items.map(x => ({ ...x })); });
  s.log.push({ t: '2026-10-30', k: 'pass', m: `<b>Gate 4 — Show me proof. PASSED.</b> ${Object.values(AVA.evidence).flat().length} dated artefacts collected across ${Object.keys(AVA.evidence).length} controls, including the reversal register reconciliation and the approval queue walkthrough that closed both conditions.` });
}

function seedMonitoring(s) {
  s.monitoring = JSON.parse(JSON.stringify(AVA.monitoring));
  s.log.push({ t: '2026-10-28', k: 'pass', m: `<b>Gate 6 — monitoring plan agreed.</b> Five metrics with thresholds and consequences, the 2am path, model change control, review date of 2 Feb 2027 and a retirement trigger.` });
}

function signAll(s) {
  Object.values(s.signatures).forEach(x => {
    x.date = AVA.signDate;
    s.log.push({ t: AVA.signDate, k: 'pass', m: `<b>${esc(x.role)}</b> signed: ${esc(x.name)}, ${esc(x.title)}.` });
  });
  s.log.push({ t: AVA.signDate, k: 'pass', m: `<b>Gate 5 — Who signs? APPROVED.</b> Three signatures against a frozen control set. Deployment authorised.` });
}

function avaApproved() {
  const s = avaState();
  applyConditions(s); seedEvidence(s); seedMonitoring(s); signAll(s);
  return s;
}

const actions = {
  addmetric() {
    const get = k => { const el = $(`[data-nm="${k}"]`); return el ? el.value.trim() : ''; };
    const name = get('name');
    if (!name) return;
    (state.monitoring.metrics = state.monitoring.metrics || []).push({
      name, target: get('target') || '—', freq: get('freq') || '—', act: get('act') || '—'
    });
    log('', `<b>Monitoring metric added:</b> ${esc(name)}.`);
    render();
  },
  applyconds() { applyConditions(state); render(); },
  seedev()     { seedEvidence(state); render(); },
  seedmon()    { seedMonitoring(state); render(); },
  modelchange() {
    // Snapshot what was actually true at the moment of the trigger, so the
    // re-check below can report a real diff instead of a scripted outcome.
    const r = assessRisk();
    state.recheck = {
      done: false,
      beforeTier: r ? r.tier : null,
      beforeControls: requiredControls().map(c => c.id)
    };
    log('fail', `<b>Something changed underneath the approval.</b> Either the supplier moved the model version, or Ava's tool permissions changed — the policy treats both as the same trigger. Gate 2 re-opens in light mode before the change reaches members.`);
    render();
  },
  rechecked() {
    // This re-runs the real tiering logic against whatever state.risk holds
    // right now — it is not a canned "still fine" message. If gate 2's
    // answers were edited before this fires, the diff below reflects that.
    const before = state.recheck || {};
    const r = assessRisk();
    const nowControls = requiredControls().map(c => c.id);
    const priorControls = before.beforeControls || [];
    const added = nowControls.filter(id => !priorControls.includes(id));
    const removed = priorControls.filter(id => !nowControls.includes(id));
    const tierChanged = !!(before.beforeTier && r && before.beforeTier !== r.tier);
    const controlsChanged = added.length || removed.length;

    let summary;
    if (!r) {
      summary = 'Gate 2 is incomplete, so there is nothing to re-check against. Answer it before this can close.';
    } else if (tierChanged) {
      summary = `Tier moved from <b>${esc(TIERS[before.beforeTier].name)}</b> to <b>${esc(TIERS[r.tier].name)}</b>. A light re-check does not get to absorb that — this escalates to a full gate 2 and gate 3 review before the change ships.`;
    } else {
      summary = `Gate 2 was re-run against the current risk answers. Tier held at <b>${esc(TIERS[r.tier].name)}</b>` +
        (controlsChanged
          ? `, though the required control set shifted — ${added.length} newly required, ${removed.length} no longer required.`
          : ', and the required control set is unchanged.') +
        ' Approval remains valid; review date reset.';
    }

    state.recheck = { done: true, tierChanged, added, removed, summary };
    log(tierChanged || !r ? 'fail' : 'pass',
      `<b>${tierChanged ? 'Light re-check found a real change.' : 'Light re-check complete.'}</b> ${summary}`);
    render();
  }
};

/* ---------------------------------------------------- approval record --- */

function recordData() {
  const r = assessRisk();
  const req = requiredControls();
  const blockers = approvalBlockers();
  const signed = Object.values(state.signatures).filter(s => s.date);
  const status = blockers.length ? 'NOT APPROVED'
    : signed.length === 3 ? (Object.keys(state.conditions).length ? 'APPROVED WITH CONDITIONS' : 'APPROVED')
    : 'AWAITING SIGNATURE';
  return { r, req, blockers, signed, status };
}

function renderRecord() {
  const { r, req, blockers, status } = recordData();
  const v = state.intake;
  const ok = status.startsWith('APPROVED');

  const html = `
  <div class="rechead">
    <h3 style="margin:0">${esc(v.name || 'Unnamed use case')} — approval record</h3>
    <p style="margin:4px 0 0">Generated ${fmt(today())} · Northbridge Credit Union</p>
    <span class="stamp-big ${ok ? 'ok' : 'bad'}">${status}</span>
  </div>

  <h4>The use case</h4>
  <dl>
    <dt>Purpose</dt><dd>${esc(v.purpose || '—')}</dd>
    <dt>Accountable executive</dt><dd>${esc(v.owner || '—')}</dd>
    <dt>Who talks to it</dt><dd>${esc(v.users || '—')}</dd>
    <dt>Data in scope</dt><dd>${esc((v.data || []).join(', ') || '—')}</dd>
    <dt>Tool permissions</dt><dd>${esc((v.tools || []).join(', ') || '—')}</dd>
    <dt>Model</dt><dd>${esc(v.model || '—')}</dd>
    <dt>Target go-live</dt><dd>${esc(v.golive || '—')}</dd>
  </dl>

  <h4>Article 5 screen</h4>
  ${(() => {
    const pp = v.prohibited || {};
    const flaggedC = PROHIBITED_CHECKS.filter(c => pp[c.id] === true);
    if (flaggedC.length) return `<p style="color:var(--bad)"><strong>${flaggedC.length} of ${PROHIBITED_CHECKS.length} flagged</strong> — not approvable under any control set until legal confirms an exception in writing.</p>
      <ul>${flaggedC.map(c => `<li><strong>${esc(c.article)}</strong> — ${esc(c.q)}</li>`).join('')}</ul>`;
    const clearedC = PROHIBITED_CHECKS.filter(c => pp[c.id] === false).length;
    return `<p>Cleared — ${clearedC} of ${PROHIBITED_CHECKS.length} checks, no EU AI Act Article 5 prohibited practice identified.</p>`;
  })()}

  <h4>Risk tier</h4>
  <p><strong>${r ? esc(TIERS[r.tier].name) : 'Not assessed'}</strong>${r ? ` — raw exposure ${r.raw} of ${r.max}.` : ''}</p>
  ${r && r.fired.length ? `<ul>${r.fired.map(e => `<li>${esc(e.say)}</li>`).join('')}</ul>` : ''}

  <h4>Controls (${req.length} required)</h4>
  <ul>${req.map(c => {
    const s = state.controls[c.id] || {};
    const cond = state.conditions[c.id];
    const mark = s.status === 'yes' ? (cond ? 'In place, under condition' : 'In place')
      : s.status === 'no' ? 'NOT IN PLACE' : s.status === 'na' ? 'Not applicable' : 'Not assessed';
    const evn = (state.evidence[c.id] || []).length;
    return `<li><strong>${esc(c.name)}</strong> — ${esc(mark)} · ${evn} artefact${evn === 1 ? '' : 's'}
      ${cond ? `<br><em>Condition: ${esc(cond.text)}</em><br><small>Owner ${esc(cond.owner)}, due ${fmt(cond.due)}</small>` : ''}</li>`;
  }).join('')}</ul>

  <h4>Signatures</h4>
  ${Object.values(state.signatures).map(s => `<p><strong>${esc(s.role)}:</strong> ${s.date
    ? `${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''} — signed ${fmt(s.date)}`
    : '<em>unsigned</em>'}</p>`).join('')}
  ${blockers.length ? `<p style="color:var(--bad)"><strong>Blocked:</strong> ${blockers.map(esc).join(' ')}</p>` : ''}

  <h4>Post-deployment</h4>
  ${(state.monitoring.metrics || []).length ? `<ul>${state.monitoring.metrics.map(m =>
    `<li>${esc(m.name)} — threshold ${esc(m.target)}, ${esc(m.freq.toLowerCase())}. ${esc(m.act)}</li>`).join('')}</ul>` : '<p>No metrics defined.</p>'}
  <p><strong>Incident path:</strong> ${esc(state.monitoring.incident || '—')}</p>
  <p><strong>Model change:</strong> ${esc(state.monitoring.modelChange || '—')}</p>
  <p><strong>Next review:</strong> ${esc(state.monitoring.review ? fmt(state.monitoring.review) : '—')}</p>
  <p><strong>Retirement trigger:</strong> ${esc(state.monitoring.retire || '—')}</p>

  <h4>Decision history</h4>
  <ul>${[...state.log].sort((a, b) => a.t.localeCompare(b.t)).map(e =>
    `<li>${fmt(e.t)} — ${e.m.replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>')}</li>`).join('')}</ul>`;

  $('#recbody').innerHTML = html;
  $('#modal').hidden = false;
}

function recordMarkdown() {
  const { r, req, status } = recordData();
  const v = state.intake;
  const L = [];
  L.push(`# ${v.name || 'Unnamed use case'} — approval record`, '');
  L.push(`**Status:** ${status}`, `**Generated:** ${fmt(today())}`, '');
  L.push('## The use case', '');
  L.push(`- **Purpose:** ${v.purpose || '—'}`);
  L.push(`- **Accountable executive:** ${v.owner || '—'}`);
  L.push(`- **Who talks to it:** ${v.users || '—'}`);
  L.push(`- **Data in scope:** ${(v.data || []).join(', ') || '—'}`);
  L.push(`- **Tool permissions:** ${(v.tools || []).join(', ') || '—'}`);
  L.push(`- **Model:** ${v.model || '—'}`);
  L.push(`- **Target go-live:** ${v.golive || '—'}`, '');
  L.push('## Article 5 screen', '');
  {
    const pp = v.prohibited || {};
    const flaggedC = PROHIBITED_CHECKS.filter(c => pp[c.id] === true);
    if (flaggedC.length) {
      L.push(`**${flaggedC.length} of ${PROHIBITED_CHECKS.length} flagged** — not approvable under any control set until legal confirms an exception in writing.`, '');
      flaggedC.forEach(c => L.push(`- **${c.article}** — ${c.q}`));
      L.push('');
    } else {
      const clearedC = PROHIBITED_CHECKS.filter(c => pp[c.id] === false).length;
      L.push(`Cleared — ${clearedC} of ${PROHIBITED_CHECKS.length} checks, no EU AI Act Article 5 prohibited practice identified.`, '');
    }
  }
  L.push('## Risk tier', '');
  L.push(r ? `**${TIERS[r.tier].name}** — raw exposure ${r.raw} of ${r.max}.` : 'Not assessed.', '');
  (r ? r.fired : []).forEach(e => L.push(`- ${e.say}`));
  L.push('', `## Controls (${req.length} required)`, '');
  req.forEach(c => {
    const s = state.controls[c.id] || {}, cond = state.conditions[c.id];
    const mark = s.status === 'yes' ? (cond ? 'In place, under condition' : 'In place')
      : s.status === 'no' ? '**NOT IN PLACE**' : s.status === 'na' ? 'Not applicable' : 'Not assessed';
    L.push(`- **${c.name}** — ${mark} · ${(state.evidence[c.id] || []).length} artefact(s)`);
    if (cond) L.push(`  - Condition: ${cond.text} (owner ${cond.owner}, due ${fmt(cond.due)})`);
  });
  L.push('', '## Signatures', '');
  Object.values(state.signatures).forEach(s => L.push(
    `- **${s.role}:** ${s.date ? `${s.name}${s.title ? ', ' + s.title : ''} — signed ${fmt(s.date)}` : '_unsigned_'}`));
  L.push('', '## Post-deployment', '');
  (state.monitoring.metrics || []).forEach(m =>
    L.push(`- ${m.name} — threshold ${m.target}, ${m.freq.toLowerCase()}. ${m.act}`));
  L.push('', `**Incident path:** ${state.monitoring.incident || '—'}`);
  L.push('', `**Model change:** ${state.monitoring.modelChange || '—'}`);
  L.push('', `**Next review:** ${state.monitoring.review ? fmt(state.monitoring.review) : '—'}`);
  L.push('', `**Retirement trigger:** ${state.monitoring.retire || '—'}`);
  L.push('', '## Decision history', '');
  [...state.log].sort((a, b) => a.t.localeCompare(b.t)).forEach(e =>
    L.push(`- **${fmt(e.t)}** — ${e.m.replace(/<[^>]+>/g, '')}`));
  return L.join('\n');
}

/* ------------------------------------------------------ methodology ----- */
/* Plain-language explainer, aimed at a reader with no governance or legal
   background. A handful of live figures are pulled in rather than typed as
   fixed numbers, so this can't quietly drift out of sync with the actual
   question count, weight split or escalation rules if those ever change. */

function renderMethodology() {
  const heavy = RISK_QUESTIONS.filter(q => q.weight === 2).length;
  const light = RISK_QUESTIONS.filter(q => q.weight === 1).length;

  $('#methbody').innerHTML = `
    <h3 style="margin-top:0">The question underneath everything</h3>
    <p>A board does not want a philosophy of AI safety. It wants one specific thing: proof that before an AI agent went live, someone who could be held responsible looked hard enough, wrote it down, and can show the paper trail if something goes wrong later. This tool is built around six checkpoints that produce exactly that paper trail.</p>

    <h4>The six checkpoints, in order</h4>
    <ol style="padding-left:20px">
      <li><b>What is it?</b> — describe it in plain terms: what it does, who it talks to, what it is allowed to touch.</li>
      <li><b>How much could go wrong?</b> — eight questions turn that description into a risk level.</li>
      <li><b>What has to be true before launch?</b> — the risk level decides which safeguards are required.</li>
      <li><b>Show me proof</b> — each safeguard needs a real, dated piece of evidence, not just a claim.</li>
      <li><b>Who signs?</b> — one named person takes responsibility, with two more confirming they reviewed it.</li>
      <li><b>Is it still safe?</b> — after launch, what is being watched, and what would trigger a re-check.</li>
    </ol>
    <p>They run in this order on purpose. You cannot decide how careful to be (2) before you know what the thing is (1). You cannot demand safeguards (3) before you know how risky it is (2). And so on down the list.</p>

    <h4>Before any of that: is this even allowed?</h4>
    <p>Some AI uses are not just risky — they are not permitted at all under EU law, no matter how many safeguards get added. Manipulating people below their conscious awareness. Scoring someone's "trustworthiness" from unrelated behaviour. Identifying named people in real time from public camera feeds. ${PROHIBITED_CHECKS.length} fast yes/no questions check for this, right at the start of gate 1, before any time is spent on the rest. A "yes" to any of them does not mean "be more careful" — it means stop, and get a lawyer's answer in writing before designing anything further.</p>

    <h4>How "how risky is this" actually gets decided</h4>
    <p>${RISK_QUESTIONS.length} questions, each answered on the same four-point scale: Low, Moderate, High, Severe. Things like: how much money can it move without a person checking first? How much does it decide entirely on its own? If it gets something wrong, how hard is that to undo?</p>
    <p>Not every question matters equally, so not every question counts equally. ${heavy} of them — how much money is involved, how independently it acts, how hard a mistake is to undo, and the widest thing it is allowed to touch — set the ceiling on how bad a single failure can be, so each counts twice. The other ${light} — how many people one failure could touch, how sensitive the data is, whether EU rules apply, and whether it reads text written by people it does not control — usually make an existing problem worse rather than create a new ceiling on their own, so each counts once.</p>
    <p>All ${RISK_QUESTIONS.length} answers, weighted this way, get averaged into a single number from 0 to 3. If that average lands at ${TIER1_AVG_SEVERITY.toFixed(1)} or higher — roughly "High" — it is automatically the strictest category. If it stays under ${TIER3_AVG_SEVERITY.toFixed(1)} — roughly "Moderate" — it is the lightest. Anything in between is the middle category.</p>

    <h4>The twist: some combinations are worse than their parts</h4>
    <p>Averaging treats every dangerous thing as if it adds up politely. It does not. A system that lets anyone type anything at it <i>and</i> can move money is not "moderately risky twice" — it is a different, worse problem, because the two facts combine into something neither one is alone. So on top of the average, a short list of ${ESCALATIONS.length} specific dangerous combinations can force the strictest category regardless of what the math says — each one written as a plain sentence, not hidden in a formula, so a non-technical reviewer can read it and agree or push back.</p>

    <h4>What happens with the answer</h4>
    <p>The risk category decides which safeguards are actually required — not a fixed checklist everyone gets regardless of how risky they are, but a list generated from the specific answers given. Each required safeguard needs a real piece of evidence before anyone signs: a test result, a config screenshot, a log sample, with a date and a named owner. Then one person — not a committee — signs their name to it, alongside confirmation from risk and legal that they reviewed it. After launch, specific numbers get watched on a schedule, with a stated consequence if they cross a line, plus a rule for what happens if the system's version or its permissions change later.</p>

    <h4>Why the example fails, then passes</h4>
    <p>The worked example in this tool is deliberately not a success story on the first try. It fails the safeguards checkpoint on two specific points, gets sent back with named conditions, an owner and a due date for each, and only reaches sign-off after those conditions are actually met and proven. That is the part worth paying attention to: a process that can only ever say yes is not really a process. It is paperwork with extra steps.</p>
  `;
  $('#methModal').hidden = false;
}

/* -------------------------------------------------------------- boot ---- */

function openApp() {
  $('#intro').hidden = true;
  $('#app').hidden = false;
  render();
}

function start(fresh) {
  state = fresh || load() || avaState();
  if (fresh) save();
  render();
}

/* Deep links, so a gate can be shared or captured directly.
     ?record=approved   the Ava record after conditions, evidence and signature
     ?record=firstpass  the Ava record as it stood when gate 3 failed
     ?regs=1            regulatory references on
     #gate-4            open at that gate                                    */
function applyDeepLink() {
  const q = new URLSearchParams(location.search);
  const rec = q.get('record');
  if (rec === 'approved') start(avaApproved());
  else if (rec === 'firstpass') start(avaState());
  if (q.get('regs') === '1') state.regs = true;

  const m = /^#gate-([1-6])$/.exec(location.hash);
  if (m) state.gate = +m[1];

  if (rec || m) { openApp(); return true; }
  return false;
}

$('#startbtn').onclick = () => { openApp(); };
$('#jumpfail').onclick = e => {
  e.preventDefault();
  state.gate = 3; openApp(); window.scrollTo(0, 0);
};
$('#resetbtn').onclick = () => {
  if (!confirm('Clear this record and start again?')) return;
  prohOpen = false;
  start(avaState());
};
$('#regtoggle').onchange = e => { state.regs = e.target.checked; render(); };
$('#recordbtn').onclick = renderRecord;
$('#closerec').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
$('#copyrec').onclick = async () => {
  const md = recordMarkdown();
  try { await navigator.clipboard.writeText(md); $('#copyrec').textContent = 'Copied'; }
  catch (e) { $('#copyrec').textContent = 'Copy failed'; }
  setTimeout(() => { $('#copyrec').textContent = 'Copy as Markdown'; }, 1600);
};
$('#methbtn').onclick = renderMethodology;
$('#closemeth').onclick = () => { $('#methModal').hidden = true; };
$('#methModal').onclick = e => { if (e.target.id === 'methModal') $('#methModal').hidden = true; };
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  $('#modal').hidden = true;
  $('#methModal').hidden = true;
});

start();
applyDeepLink();

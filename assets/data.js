/* ============================================================================
   Ava Use Case Governance Lifecycle — content layer
   Gate definitions, risk questions, control library, regulatory mapping,
   and the pre-filled Northbridge Credit Union example.

   Deliberately no vendor names anywhere. Models and providers are described
   by their governance-relevant properties, not their brand.
   ========================================================================= */

const GATES = [
  {
    n: 1,
    key: 'intake',
    client: 'What is it?',
    formal: 'Intake and scoping',
    question: 'Describe the agent in enough detail that someone who has never seen it can say what it touches.',
    time: '45 minutes',
    room: ['Product owner', 'The engineer who built it'],
    passRule: 'Every field answered. "We are still deciding" is an answer — write it down and set a date.'
  },
  {
    n: 2,
    key: 'risk',
    client: 'How much could go wrong?',
    formal: 'Risk tiering',
    question: 'Not "is AI risky". How much money, how much autonomy, how hard to undo, whose data, which regulator.',
    time: '60 minutes',
    room: ['Product owner', 'Risk', 'Security'],
    passRule: 'A tier is assigned and the reasoning is written down. Tier drives everything downstream.'
  },
  {
    n: 3,
    key: 'controls',
    client: 'What must be true before launch?',
    formal: 'Control requirements',
    question: 'The tier generates a required control set. Each control is either in place, in place with a condition, or not in place.',
    time: '90 minutes',
    room: ['Risk', 'Security', 'Legal / DPO', 'Operations lead'],
    passRule: 'No required control is left "not in place". This is the gate that stops things.'
  },
  {
    n: 4,
    key: 'evidence',
    client: 'Show me proof',
    formal: 'Evidence collection',
    question: 'A control is not a control until someone can point at the artefact. Screenshots, test results, config exports, log samples.',
    time: '2 weeks elapsed, ~4 hours of review',
    room: ['Whoever ran the tests', 'Risk reviewer'],
    passRule: 'Every required control has at least one dated artefact with a named owner.'
  },
  {
    n: 5,
    key: 'approval',
    client: 'Who signs?',
    formal: 'Approval record',
    question: 'One accountable executive, plus risk and legal. A committee cannot be fired. A person can.',
    time: '30 minutes',
    room: ['Accountable executive', 'Chief Risk Officer', 'General Counsel / DPO'],
    passRule: 'Three signatures against a frozen control set. No signature, no deploy.'
  },
  {
    n: 6,
    key: 'monitoring',
    client: 'Is it still safe?',
    formal: 'Post-deployment monitoring',
    question: 'Approval is a snapshot. The model changes, the prompt changes, the world changes. What tells you it drifted?',
    time: '30 minutes to set up, 30 minutes quarterly',
    room: ['Operations owner', 'Risk'],
    passRule: 'Named metrics with thresholds, a paging path, a model-change trigger, a review date, a retirement trigger.'
  }
];

/* --------------------------------------------------------------------------
   Gate 1 — intake fields
   -------------------------------------------------------------------------- */

const INTAKE_FIELDS = [
  { id: 'name', label: 'What is it called?', type: 'text', hint: 'The name staff and members will use.' },
  { id: 'purpose', label: 'What is it for, in one sentence a member would understand?', type: 'textarea',
    hint: 'If you need two sentences, the scope is probably two use cases.' },
  { id: 'owner', label: 'Who is accountable if it goes wrong?', type: 'text',
    hint: 'One named person with a job title. Not a team, not a committee.' },
  { id: 'users', label: 'Who talks to it?', type: 'select',
    options: ['Staff only', 'Members (authenticated)', 'Anyone on the public site', 'Members and staff'] },
  { id: 'data', label: 'What data does it see?', type: 'multi',
    options: ['Public product information', 'Member contact details', 'Account balances and transactions',
              'Credit files', 'Special category data (health, biometric, political)'] },
  { id: 'tools', label: 'What can it actually do? (tool permissions)', type: 'multi',
    hint: 'This is the question that separates an agent from a chatbot. List every function it can call.',
    options: ['Answer from a knowledge base', 'Read member account records', 'Reverse a fee',
              'Open a dispute ticket in the CRM', 'Send email to the member', 'Move money between accounts'] },
  { id: 'model', label: 'What model, hosted where?', type: 'text',
    hint: 'Describe the properties, not the brand: family, version pinning, hosting region.' },
  { id: 'vendor', label: 'Who is the supplier and what do the terms say?', type: 'textarea',
    hint: 'Training on our data, subprocessors, data residency, incident notification clock.' },
  { id: 'golive', label: 'Target go-live date', type: 'text', hint: 'A real date. It sets the clock on everything below.' }
];

/* --------------------------------------------------------------------------
   Gate 2 — risk questions
   Ordinal answers, index 0 = lowest exposure (Low/Moderate/High/Severe).

   Each question carries a `weight`. Not every dimension pushes the tier
   equally, and pretending otherwise (a flat unweighted sum) was the actual
   bug here for a while — "EU exposure" counted exactly as much as
   "autonomy". The split below is 2 for the four dimensions that set the
   ceiling on how bad a single failure can be, and 1 for the four that are
   real but either multiply that ceiling (blast) or whose sharpest danger
   is combinatorial and already captured by ESCALATIONS below (pii, eu,
   untrusted) rather than by their solo weight. See `weightWhy` on each.
   -------------------------------------------------------------------------- */

const RISK_QUESTIONS = [
  { id: 'money', label: 'How much money can it move without a human?', weight: 2,
    why: 'Financial authority is the fastest route from "chatbot mistake" to "regulatory finding".',
    weightWhy: 'Counts double — harm scales close to linearly with the dollar ceiling.',
    options: ['None — it cannot touch money', 'Small, capped per action (under $100)',
              'Material per action ($100–$5,000)', 'Uncapped or aggregate uncapped'] },
  { id: 'autonomy', label: 'How much does it decide on its own?', weight: 2,
    why: 'Autonomy level is the single strongest predictor of how bad a bad day gets.',
    weightWhy: 'Counts double — it gates whether harm needs a second failure (a human missing it) or can happen entirely unattended.',
    options: ['Recommends only — a human does the thing', 'Acts, but a human approves before it lands',
              'Acts alone inside hard limits', 'Acts alone, limits are soft or prompt-based'] },
  { id: 'reversibility', label: 'If it does the wrong thing, how hard is it to undo?', weight: 2,
    why: 'Reversibility decides whether you need prevention or whether detection is enough.',
    weightWhy: 'Counts double — it determines which category of control even applies.',
    options: ['Reversible in-session, no trace', 'Reversible with manual back-office work',
              'Reversible only with member contact and goodwill', 'Not reversible'] },
  { id: 'blast', label: 'How many people does one failure touch?', weight: 1,
    why: 'An agent looping is not one error. It is the same error a thousand times before anyone looks.',
    weightWhy: 'Counts once — it multiplies the harm the dimensions above already establish, rather than setting an independent ceiling.',
    options: ['One member per action', 'One member, but it can run unattended in a loop',
              'Batches of members', 'Every member — systemic'] },
  { id: 'pii', label: 'Whose data, and how sensitive?', weight: 1,
    why: 'Drives the DPIA, retention limits and what may be sent to a third-party model provider.',
    weightWhy: 'Counts once — it drives a distinct compliance surface more than it drives operational harm magnitude.',
    options: ['No personal data', 'Contact details only', 'Account and financial data',
              'Special category data'] },
  { id: 'eu', label: 'Is there EU exposure?', weight: 1,
    why: 'Changes the legal instrument, not just the paperwork volume.',
    weightWhy: 'Counts once — it is a jurisdictional modifier; its sharpest form (credit access) is already a hard Tier 1 floor below, not a matter of degree.',
    options: ['No EU nexus', 'EU staff only', 'EU members as customers',
              'EU members, and the system influences access to credit'] },
  { id: 'untrusted', label: 'Can untrusted text reach the model?', weight: 1,
    why: 'Prompt injection is not a model bug you can patch out. It is an architecture property of agents that read attacker-controllable text.',
    weightWhy: 'Counts once alone — its real danger is combinatorial (paired with money or tools access), which the escalation rules below capture directly.',
    options: ['No — fixed internal inputs only', 'Internal staff free text',
              'Authenticated members type freely', 'Anyone on the internet can put text in front of it'] },
  { id: 'tools', label: 'What is the widest permission it holds?', weight: 2,
    why: 'Governance should follow the permission, not the intention.',
    weightWhy: 'Counts double — it sets the ceiling of what is possible regardless of how the system behaves most of the time.',
    options: ['Read-only, public data', 'Read-only, member data', 'Write to tickets and records',
              'Write to money or entitlements'] }
];

/* Escalation rules: agent-specific combinations that set a tier floor
   regardless of the arithmetic. This is where judgement lives. */
const ESCALATIONS = [
  { floor: 1, test: a => a.untrusted >= 2 && a.tools >= 3,
    say: 'Untrusted text reaches a model that holds write access to money. Prompt injection becomes a payments problem, not a content problem.' },
  { floor: 1, test: a => a.autonomy >= 2 && a.money >= 1 && a.reversibility >= 1,
    say: 'It acts alone, it moves money, and undoing it costs back-office effort. Detection after the fact is not sufficient.' },
  { floor: 1, test: a => a.eu >= 3,
    say: 'EU members plus influence over access to credit. Treat as high-risk classification territory until legal says otherwise in writing.' },
  { floor: 2, test: a => a.autonomy >= 2 && a.blast >= 1,
    say: 'It can act alone and repeat itself unattended. One bad reasoning step becomes many identical bad outcomes.' },
  { floor: 2, test: a => a.pii >= 2 && a.untrusted >= 2,
    say: 'Financial personal data in the same context window as attacker-controllable text. Exfiltration via output is a live path.' },
  { floor: 2, test: a => a.reversibility >= 3,
    say: 'Irreversible actions. There is no rollback plan to fall back on, so the control has to be preventive.' }
];

const TIERS = {
  1: { id: 1, name: 'Tier 1 — High', klass: 't1',
       means: 'Full control set. Executive signature required. Quarterly review. Pre-launch adversarial testing is mandatory, not advisory.' },
  2: { id: 2, name: 'Tier 2 — Elevated', klass: 't2',
       means: 'Core control set. Risk and legal sign, executive is informed. Semi-annual review.' },
  3: { id: 3, name: 'Tier 3 — Limited', klass: 't3',
       means: 'Light control set. Product owner signs, risk is notified. Annual review. Re-tier if scope grows.' }
};

/* Where the tier cutoff actually sits. The eight risk answers are weighted
   (see RISK_QUESTIONS) and averaged into a single severity figure on the
   same 0-3 (Low-Severe) scale each individual question uses. These two
   numbers are the policy decision, named as such rather than left as an
   unexplained fraction of some maximum score: Tier 1 begins once that
   weighted average reaches High; Tier 3 requires it to stay below
   Moderate. Escalation rules can still override the result upward
   regardless of where the average lands. */
const TIER1_AVG_SEVERITY = 2; // "High" on average, weighted
const TIER3_AVG_SEVERITY = 1; // below "Moderate" on average, weighted

/* --------------------------------------------------------------------------
   Gate 3 — control library
   `req` decides whether a control is required for these answers.
   -------------------------------------------------------------------------- */

const CONTROLS = [
  {
    id: 'human-approval',
    group: 'Human oversight',
    name: 'Human approval above a money threshold',
    plain: 'Above a stated dollar amount the agent proposes and a person approves. The threshold is config, not prompt text.',
    ask: 'What is the number, where is it stored, and who can change it?',
    req: a => a.money >= 1 && a.autonomy >= 2,
    nist: ['GOVERN 3.2', 'MANAGE 2.4'],
    eu: ['Art. 14 (if high-risk)', 'Art. 26(2) deployer oversight']
  },
  {
    id: 'action-log',
    group: 'Traceability',
    name: 'Immutable action log',
    plain: 'Every tool call the agent makes, with inputs, outputs, timestamp, member ID and the reasoning it gave. Append-only.',
    ask: 'Can you reconstruct a single member interaction end to end, six months later?',
    req: a => a.autonomy >= 1,
    nist: ['MEASURE 2.8', 'MANAGE 4.1'],
    eu: ['Art. 12 record-keeping (if high-risk)', 'Art. 19 log retention']
  },
  {
    id: 'reversal-log',
    group: 'Traceability',
    name: 'Financial action register',
    plain: 'Every fee reversal or money movement written to a register the agent cannot edit: amount, member, reason, agent reasoning, reviewer.',
    ask: 'If the board asks how much the agent gave away last quarter, how long does that take to answer?',
    req: a => a.money >= 1,
    nist: ['MEASURE 2.8', 'MANAGE 4.1'],
    eu: ['Art. 12 record-keeping (if high-risk)']
  },
  {
    id: 'scope-limits',
    group: 'Containment',
    name: 'Hard tool permission scope',
    plain: 'The agent holds an explicit allowlist of functions at the API layer. Restrictions live in code and credentials, never only in the system prompt.',
    ask: 'If the prompt were replaced with an empty string, what could it still do?',
    req: a => a.tools >= 2,
    nist: ['MAP 2.1', 'MANAGE 2.4'],
    eu: ['Art. 15 accuracy and robustness (if high-risk)']
  },
  {
    id: 'injection-test',
    group: 'Containment',
    name: 'Prompt injection test before launch',
    plain: 'An adversarial pass where a tester poses as a member and tries to make the agent exceed its authority. Documented attempts, documented outcomes.',
    ask: 'Did anyone try to talk it into a $500 reversal before a member did?',
    req: a => a.untrusted >= 2,
    nist: ['MEASURE 2.7', 'GOVERN 4.3'],
    eu: ['Art. 15(5) resilience against manipulation (if high-risk)']
  },
  {
    id: 'kill-switch',
    group: 'Containment',
    name: 'Kill switch, named and tested',
    plain: 'One named on-call person can disable the agent in under five minutes without a deployment. Tested in a drill, not just documented.',
    ask: 'Who pressed it in the drill, and how long did it take?',
    req: a => a.autonomy >= 2,
    nist: ['MANAGE 2.4', 'GOVERN 6.2'],
    eu: ['Art. 14(4)(e) stop button (if high-risk)']
  },
  {
    id: 'incident-path',
    group: 'Containment',
    name: 'The 2am path',
    plain: 'It is 2am and the agent is reversing fees it should not. Who is paged, what are they allowed to do without waking an executive, and when does the clock on regulator notification start?',
    ask: 'Name the person on call this weekend.',
    req: a => a.autonomy >= 1,
    nist: ['MANAGE 2.3', 'MANAGE 4.3', 'GOVERN 4.3'],
    eu: ['Art. 73 serious incident reporting (if high-risk)', 'GDPR Art. 33']
  },
  {
    id: 'pii-redaction',
    group: 'Data',
    name: 'PII minimisation before the model call',
    plain: 'Account numbers and identifiers are tokenised or stripped before the prompt leaves your perimeter, and again before anything is written to logs.',
    ask: 'Pull a raw log line. What is in it?',
    req: a => a.pii >= 1,
    nist: ['MEASURE 2.10', 'MAP 4.1'],
    eu: ['GDPR Art. 5(1)(c) minimisation', 'GDPR Art. 35 DPIA']
  },
  {
    id: 'retention',
    group: 'Data',
    name: 'Retention limit and deletion path',
    plain: 'Conversations expire on a stated schedule, and a member erasure request reaches the agent transcripts too.',
    ask: 'Where do transcripts live, and who can delete them?',
    req: a => a.pii >= 1,
    nist: ['MEASURE 2.10'],
    eu: ['GDPR Art. 5(1)(e)', 'GDPR Art. 17']
  },
  {
    id: 'vendor-terms',
    group: 'Third party',
    name: 'Supplier terms reviewed and recorded',
    plain: 'No training on member data, named subprocessors, data residency, breach notification clock, and what happens to your data if the contract ends.',
    ask: 'Which clause says they will not train on this?',
    req: () => true,
    nist: ['GOVERN 6.1', 'MANAGE 3.1', 'MAP 4.1'],
    eu: ['Art. 25 value chain responsibilities', 'DORA Art. 28–30 (EU financial entities)']
  },
  {
    id: 'model-change',
    group: 'Third party',
    name: 'Model change control',
    plain: 'The version is pinned. When the supplier deprecates it, or Ava\'s tool permissions change, gate 2 re-runs in light mode before the change reaches members.',
    ask: 'What happens to this approval when the model changes — or when someone changes what Ava is allowed to do?',
    req: () => true,
    nist: ['MANAGE 3.1', 'MEASURE 3.1', 'GOVERN 6.1'],
    eu: ['Art. 72 post-market monitoring (if high-risk)']
  },
  {
    id: 'disclosure',
    group: 'Member-facing',
    name: 'Disclosure and route to a human',
    plain: 'The member is told at the start that they are talking to an AI agent, and can reach a person in one step.',
    ask: 'Read the first message the member sees. Does it say so?',
    req: a => a.eu >= 2 || a.users_public === true || a.untrusted >= 2,
    nist: ['MEASURE 2.8', 'GOVERN 1.1'],
    eu: ['Art. 50(1) transparency — applies from 2 Aug 2026', 'Art. 4 AI literacy']
  },
  {
    id: 'quality-sampling',
    group: 'Monitoring',
    name: 'Sampled human review of answers',
    plain: 'A person reads a fixed sample of transcripts every week against a rubric, and the failure rate is a tracked number.',
    ask: 'What was last week\'s number?',
    req: (a, tier) => tier <= 2,
    nist: ['MEASURE 2.6', 'MEASURE 1.1', 'MANAGE 4.1'],
    eu: ['Art. 26(5) deployer monitoring (if high-risk)']
  },
  {
    id: 'eu-records',
    group: 'Member-facing',
    name: 'EU documentation pack',
    plain: 'Purpose, data sources, oversight design, testing and logging retention held in one place, ready if a supervisor asks.',
    ask: 'Could you hand this over in a week?',
    req: a => a.eu >= 2,
    nist: ['GOVERN 1.1', 'MAP 1.1'],
    eu: ['Art. 11 + Annex IV (if high-risk)', 'Art. 26(6) log retention']
  }
];

/* --------------------------------------------------------------------------
   The Ava example — Northbridge Credit Union
   Loaded at FIRST PASS state, where gate 3 fails.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Gate 1 — Article 5 prohibited-practice screening
   Binary, not tiered: a "yes" here is not a higher risk tier, it is a stop.
   These eight map to EU AI Act Article 5(1)(a)-(h). Most systems clear all
   eight in under a minute — the point of the screen is not thoroughness,
   it is catching the rare system that should not be designed further
   before a lawyer says so in writing, before any time is spent on tiering
   a thing that was never going to be approvable regardless of controls.
   -------------------------------------------------------------------------- */
const PROHIBITED_CHECKS = [
  { id: 'subliminal', article: 'Art. 5(1)(a)',
    q: 'Does it try to influence behaviour in ways a person would not consciously notice, or could not reasonably resist?' },
  { id: 'vulnerability', article: 'Art. 5(1)(b)',
    q: 'Does it target people by age, disability, or financial hardship in a way designed to exploit that?' },
  { id: 'socialscoring', article: 'Art. 5(1)(c)',
    q: 'Does it score or rank people’s trustworthiness or character from unrelated behaviour, in a way that could unfairly limit what they get access to later?' },
  { id: 'predictivepolicing', article: 'Art. 5(1)(d)',
    q: 'Does it predict whether a specific person will commit a crime, based on profiling or personality traits rather than an actual act?' },
  { id: 'facescraping', article: 'Art. 5(1)(e)',
    q: 'Does it build or expand a facial-recognition database by scraping images from the internet or CCTV?' },
  { id: 'emotion', article: 'Art. 5(1)(f)',
    q: 'Does it infer emotions in a workplace or school setting, for reasons other than genuine medical or safety need?' },
  { id: 'biocategorise', article: 'Art. 5(1)(g)',
    q: 'Does it use biometric data to infer someone’s race, political views, union membership, religion, or sexual orientation?' },
  { id: 'remotebio', article: 'Art. 5(1)(h)',
    q: 'Does it identify specific named people in real time from live camera feeds in public spaces?' }
];

const AVA = {
  intake: {
    name: 'Ava',
    purpose: 'Answers member questions about their accounts, reverses small fees where policy allows, and opens dispute tickets — in chat, without a queue.',
    owner: 'Head of Member Operations',
    users: 'Members (authenticated)',
    data: ['Public product information', 'Member contact details', 'Account balances and transactions'],
    tools: ['Answer from a knowledge base', 'Read member account records', 'Reverse a fee', 'Open a dispute ticket in the CRM'],
    model: 'Hosted general-purpose LLM, version pinned, EU and US regional endpoints. No fine-tuning on member data.',
    vendor: 'Third-party model provider under a negotiated enterprise agreement. Contractual no-training commitment, named subprocessors, EU data residency option, 24-hour breach notification. Reviewed by Legal 12 Aug 2026.',
    golive: '2 November 2026',
    // Cleared 5 Aug 2026, same day as the rest of intake. All eight are
    // genuinely "no" for Ava — a fee-reversal support agent doesn't come
    // close to any of these — which is the ordinary, unremarkable outcome
    // this screen is supposed to produce most of the time.
    prohibited: { subliminal: false, vulnerability: false, socialscoring: false, predictivepolicing: false,
                  facescraping: false, emotion: false, biocategorise: false, remotebio: false }
  },
  risk: { money: 1, autonomy: 2, reversibility: 1, blast: 1, pii: 2, eu: 2, untrusted: 2, tools: 3 },

  /* First pass: two controls fail. This is the story. */
  controlsFirstPass: {
    'human-approval': { status: 'no',
      note: 'Fee reversal up to $50 executes with no human in the loop. The $50 ceiling is a sentence in the system prompt, not a check in code.' },
    'reversal-log':   { status: 'no',
      note: 'Reversals post to the core banking ledger, but nothing records which agent decision caused them or what reasoning it gave. The ledger shows an adjustment with no author.' },
    'action-log':     { status: 'yes', note: 'Tool calls logged to the platform observability stack, 13-month retention.' },
    'scope-limits':   { status: 'yes', note: 'Four functions on an API-layer allowlist. Money transfer function not issued to the agent credential.' },
    'injection-test': { status: 'yes', note: 'Security ran a two-day adversarial pass. 3 of 47 attempts moved the agent off policy; all three fixed before this review.' },
    'kill-switch':    { status: 'yes', note: 'Feature flag, on-call can disable in under 2 minutes. Drill run 21 Aug 2026.' },
    'incident-path':  { status: 'yes', note: 'Existing payments incident runbook extended with an AI section. Ops on-call is first responder.' },
    'pii-redaction':  { status: 'yes', note: 'Account numbers tokenised before the model call and before logging.' },
    'retention':      { status: 'yes', note: 'Transcripts expire at 90 days. Erasure requests reach the transcript store via the existing DSAR workflow.' },
    'vendor-terms':   { status: 'yes', note: 'Legal review complete 12 Aug 2026. No-training clause at §7.3.' },
    'model-change':   { status: 'yes', note: 'Version pinned in config. Change requires a light re-run of gate 2.' },
    'disclosure':     { status: 'yes', note: 'First message identifies Ava as an AI assistant and offers a human in one tap.' },
    'quality-sampling': { status: 'yes', note: '50 transcripts a week reviewed against a 6-point rubric by the Member Ops team lead.' },
    'eu-records':     { status: 'yes', note: 'Documentation pack held in the governance repository, owned by Risk.' }
  },

  /* What changed to clear the gate on the second pass. */
  conditions: {
    'human-approval': {
      text: 'Threshold moved out of the prompt into service configuration and lowered to $25. Reversals between $25 and $50 queue for member-services approval with a 4-hour SLA. Threshold changes require CRO countersignature.',
      owner: 'Head of Member Operations',
      due: '2026-10-20'
    },
    'reversal-log': {
      text: 'Every reversal writes to a separate append-only register the agent credential cannot modify: member ID, amount, policy reason, agent reasoning text, approver where applicable. Reconciled to the ledger nightly.',
      owner: 'Engineering Lead, Member Platforms',
      due: '2026-10-27'
    }
  },

  evidence: {
    'human-approval': [{ name: 'Threshold configuration export (service config, not prompt)', date: '2026-10-21', owner: 'Engineering Lead' },
                       { name: 'Approval queue walkthrough — 12 test reversals, 5 held for review', date: '2026-10-22', owner: 'Member Ops' }],
    'reversal-log':   [{ name: 'Reversal register schema and write-permission matrix', date: '2026-10-27', owner: 'Engineering Lead' },
                       { name: 'Nightly reconciliation report, 5 consecutive days', date: '2026-10-30', owner: 'Finance Ops' }],
    'action-log':     [{ name: 'Log sample — one member interaction reconstructed end to end', date: '2026-09-30', owner: 'Engineering Lead' }],
    'scope-limits':   [{ name: 'API allowlist and agent credential scope export', date: '2026-09-28', owner: 'Security' }],
    'injection-test': [{ name: 'Adversarial test report — 47 attempts, 3 findings, all closed', date: '2026-09-18', owner: 'Security' }],
    'kill-switch':    [{ name: 'Kill switch drill record — disabled in 1m 48s', date: '2026-08-21', owner: 'Ops on-call' }],
    'incident-path':  [{ name: 'AI incident runbook §4, with on-call rota', date: '2026-09-05', owner: 'Ops' }],
    'pii-redaction':  [{ name: 'Redaction test — 200 sampled prompts and log lines, zero account numbers', date: '2026-09-22', owner: 'Security' }],
    'retention':      [{ name: 'Retention policy and DSAR workflow update', date: '2026-09-12', owner: 'DPO' }],
    'vendor-terms':   [{ name: 'Legal review memo and clause map', date: '2026-08-12', owner: 'Legal' }],
    'model-change':   [{ name: 'Version pin in config + change control procedure', date: '2026-09-15', owner: 'Engineering Lead' }],
    'disclosure':     [{ name: 'Screenshot of member-facing opening message and handoff', date: '2026-09-25', owner: 'Product' }],
    'quality-sampling': [{ name: 'Review rubric and four weeks of pilot scores', date: '2026-10-15', owner: 'Member Ops' }],
    'eu-records':     [{ name: 'Documentation pack index', date: '2026-10-01', owner: 'Risk' }]
  },

  /* Signed after evidence closes (30 Oct) and before go-live (2 Nov). */
  signDate: '2026-10-31',

  signatures: {
    exec:  { role: 'Accountable executive', name: 'M. Okonjo', title: 'Head of Member Operations', date: '' },
    risk:  { role: 'Risk', name: 'D. Halvorsen', title: 'Chief Risk Officer', date: '' },
    legal: { role: 'Legal / Data Protection', name: 'R. Beaumont', title: 'General Counsel and DPO', date: '' }
  },

  monitoring: {
    metrics: [
      { name: 'Reversals above threshold executed without approval', target: '0', freq: 'Daily', act: 'Any occurrence pages on-call and pauses the reversal tool' },
      { name: 'Weekly transcript review failure rate', target: 'Under 5%', freq: 'Weekly', act: 'Above 5% for two weeks — Risk review; above 10% — pause' },
      { name: 'Escalation-to-human rate', target: '10–25%', freq: 'Weekly', act: 'Below 10% suggests it is over-reaching. Above 25% suggests it is not useful.' },
      { name: 'Prompt injection attempts detected', target: 'Tracked, no target', freq: 'Weekly', act: 'Any successful attempt is an incident' },
      { name: 'Total value reversed', target: 'Under $8,000/month', freq: 'Monthly', act: 'Reported to Board Risk Committee quarterly' }
    ],
    incident: 'Ops on-call is first responder and may disable Ava without escalation. Head of Member Operations notified within 30 minutes. Any incident touching member funds or personal data goes to CRO and DPO within 2 hours; the GDPR 72-hour clock is assumed to start at detection.',
    modelChange: 'Version is pinned. A supplier version change, a system prompt change touching authority or scope, or a new tool permission triggers a light re-run of gate 2 before release.',
    review: '2027-02-02',
    retire: 'Retire if the weekly failure rate stays above 10% for a month, if escalation-to-human exceeds 40%, or if the use case is folded into a different platform. Retirement means the credential is revoked, logs are retained to the stated schedule, and the approval record is marked closed.'
  }
};

/* --------------------------------------------------------------------------
   Regulatory framing — shown only when the toggle is on.
   -------------------------------------------------------------------------- */

/* Keyed rather than indexed: app.js pulls specific notes into specific gates,
   and an array would re-shuffle silently every time a paragraph is added. */
const REG_NOTE = {
  heading: 'What actually applies to Ava',

  disclaimer: '<strong>This classification reading is the governance designer\'s own evaluation, not legal advice.</strong> A real deployment needs counsel to confirm or reject it in writing before launch, and that written position belongs in gate 4 as a dated artefact with a named owner. Where the two differ, counsel governs.',

  annex3: 'On that reading, Ava <strong>likely falls outside</strong> Annex III. It answers questions, reverses small fees against existing policy, and opens tickets, rather than evaluating creditworthiness or scoring members, which is what Annex III 5(b) captures. Held with moderate confidence — the point that would test it is whether a fee waiver that varies between members affects access to a service in substance, whatever the policy says on paper. Claiming high-risk status where it may not apply is not conservatism either: it burns credibility and risks burying the obligations that do bite.',

  applies: 'What appears to apply from day one: <strong>Article 50(1)</strong> transparency, since Ava interacts directly with natural persons and must be designed so members know they are talking to an AI system (in application since 2 August 2026). <strong>Article 4</strong> AI literacy for the staff who supervise it. <strong>Article 25</strong> if Northbridge puts its own name on the system in a way that makes it a provider rather than a deployer. And GDPR throughout, which is doing most of the real work here — including <strong>Article 22</strong>, the right not to be subject to a solely-automated decision with legal or similarly significant effect. A fee reversal decided by Ava alone is close to the case that article exists for, and it deserves saying plainly: no control in this library yet operationalises the post-decision contest right Article 22 requires. Named here rather than quietly assumed covered.',

  watch: 'The line to watch: if Ava is later extended to influence lending decisions, Annex III 5(b) engages on any reading and the entire obligation set changes — conformity assessment, Article 11 technical documentation, Article 14 human oversight, registration. That is a re-tier, not a feature release. It is written into the model change control for a reason.',

  nist: 'NIST AI RMF is used here as the structure rather than the authority. It is voluntary, and it maps cleanly onto what a credit union board already understands: govern, map, measure, manage.'
};

# Regulatory notes

How NIST AI RMF 1.0 and Regulation (EU) 2024/1689 are used in this lifecycle, and — more usefully — where they are *not* used.

These references sit behind a toggle in the app, off by default. That is a deliberate design choice. Leading a launch review with legal citations is how you lose the room in the first ten minutes; the operations manager who has to answer gate 3 needs the question, not the article number. The citations exist for the person who has to write the file note afterwards.

---

> ## Disclaimer
>
> **The Annex III assessment below is exclusively my own governance evaluation.**
>
> It is a working position I formed for the purposes of this exercise, on a fictional use case, to demonstrate how a classification question gets reasoned through inside a governance process. It is **not legal advice, not a formal classification determination, and not a conformity assessment.** I am not a lawyer and this is not a qualified legal opinion.
>
> A real deployment would need counsel to confirm or reject this reading **in writing, before launch**. In this lifecycle that written legal position is itself the control — it belongs in gate 4 as a dated artefact with a named owner, not in a designer's head. Where my reading and counsel's differ, counsel's governs.
>
> Reasonable practitioners can disagree on the reading below, and national market surveillance authorities may take their own view. Treat it as a documented starting point for that conversation, not as its conclusion.

---

## Article 5 comes before Annex III, not after

Prohibited practice and high-risk classification are different questions, and it's worth being precise about the order. Annex III asks *how carefully does this need to be governed*. Article 5 asks *is this permitted to exist in the EU at all* — and that question has to clear before spending any time on the first one, not after.

Gate 1 now screens for this directly, ahead of the eight risk-tiering questions at gate 2: eight yes/no checks mapped to Article 5(1)(a) through (h) — manipulation below conscious awareness, exploiting a vulnerability, social scoring, predictive policing on individuals, facial-recognition database scraping, workplace or school emotion inference, biometric categorisation of protected characteristics, and real-time remote biometric identification in public spaces. A "yes" on any of them is not a tier — the app treats it as a hard stop that blocks approval regardless of what controls gate 3 could produce, because no control set makes a prohibited practice approvable.

Ava clears all eight, and trivially so — a support agent that answers questions and reverses fees under a published policy doesn't come close to any of them. That's worth stating plainly rather than leaving implicit: the ordinary, common outcome of this screen is a fast unanimous "no," and the value of running it isn't in Ava's case, it's in the rare case where it isn't.

## My assessment of Annex III applicability

**My working position is that Ava likely falls outside Annex III.** I want to set out the reasoning, because the reflex in a lot of governance work is to claim the strictest classification available on the theory that over-compliance is free. It is not free. It burns credibility with the business, and it risks burying the obligations that do apply underneath a pile of ones that may not.

Ava answers member questions, reverses small fees against existing policy, and opens dispute tickets. The Annex III category that gets raised in financial services is **5(b)** — AI systems intended to be used to evaluate the creditworthiness of natural persons or establish their credit score. On my reading, Ava does neither: she does not assess, score, rank or filter members in a way that affects access to a service, and reversing a $25 fee under a published fee-waiver policy looks to me like the execution of an existing entitlement rather than an evaluation of a person.

I hold that view with moderate rather than high confidence. The weaker points in it, which counsel should test:

- Whether a fee-waiver decision that varies between members could be characterised as affecting access to a financial service in substance, whatever the policy says on paper.
- Whether the dispute-ticket path feeds anything downstream that *is* an evaluation.
- Whether the supervisory authority in any member state where Northbridge operates reads 5(b) more broadly than I have.

There is also **Article 6(3)**, which allows a system that falls within an Annex III category to escape high-risk classification where it performs a narrow procedural task or does not materially influence the outcome of decision-making. On my reading it is not needed here, because Ava does not reach Annex III in the first place — but if counsel or a supervisor disagreed about 5(b), 6(3) is the second line of argument, and it would need to be documented under Article 6(4) before deployment rather than reconstructed afterwards.

### What appears to apply regardless

These are less contested than the Annex III question, though the same disclaimer applies.

| Provision | Why | Timing |
|---|---|---|
| **Article 50(1)** — transparency | Ava interacts directly with natural persons. The system must be designed and developed so that members are informed they are interacting with an AI system. This is the `disclosure` control. | In application since 2 August 2026 |
| **Article 4** — AI literacy | Northbridge must ensure a sufficient level of AI literacy among staff operating the system. In practice, the member-services team approving held reversals. | In application since 2 February 2025 |
| **Article 25** — value chain | If Northbridge puts its own name or trademark on the system in a way that makes it a provider rather than a deployer, the obligation set changes materially. Worth a written legal position, not an assumption. | — |
| **GDPR** | Doing most of the real work in this use case: Article 5(1)(c) minimisation behind the `pii-redaction` control, Article 5(1)(e) and Article 17 behind `retention`, Article 35 DPIA, Article 33 breach notification behind `incident-path`. | — |
| **GDPR Art. 22** | The right not to be subject to a decision based solely on automated processing that produces legal or similarly significant effects. A fee reversal is a financial decision about a specific member, decided by Ava alone below the approval threshold — this sits closer to the case Article 22 exists for than any other provision in this table. See note below; no control in the library currently operationalises it. | — |
| **DORA** (EU financial entities) | Articles 28–30 on ICT third-party risk are arguably the sharper instrument for the supplier relationship than anything in the AI Act. | In application since 17 January 2025 |

### Article 22 — the gap this project doesn't close

This was missing from an earlier draft, and it's worth being explicit about rather than quietly folding it into the general GDPR line above. Article 22 requires more than what's already built: the right to obtain human intervention, to express a point of view, and **to contest the decision after it was made** — not just to have a human review it before it lands.

Two existing controls come close but don't cover it. `human-approval` is preventive — a human sees the decision *before* it executes, and only above the $25 threshold; below that, Ava decides alone with nothing Article 22 would recognise as a contest path. `disclosure` routes general queries to a person, but that's a front-door escape hatch, not a mechanism aimed at *this specific reversal decision* after the fact.

Closing this properly would mean a control roughly like: *every automated decision carries a stated reason and a one-click path to a human who can overturn it, logged as a contest rather than a routine query.* That control does not exist in this library. Naming the gap here rather than either ignoring it or quietly adding a fifteenth control without discussing what it should actually require.

### The line to watch

If Ava were ever extended to influence lending decisions — pre-qualifying members, recommending limits, triaging applications — **Annex III 5(b) would engage on any reading**, and the obligation set changes completely: conformity assessment, Article 11 and Annex IV technical documentation, Article 12 record-keeping, Article 14 human oversight, Article 26 deployer obligations, registration in the EU database.

That is a re-tier, not a feature release. It is written into the `model-change` control and into gate 2's escalation rules for exactly that reason: the fourth option on the EU exposure question is *"EU members, and the system influences access to credit"*, and selecting it forces a Tier 1 floor with the stated reason that this is high-risk classification territory **until legal says otherwise in writing**.

The high-risk obligations for Annex III systems were originally due to apply from 2 August 2026, but that deadline was deferred to **2 December 2027** by Regulation (EU) 2026/1744 (the "Digital Omnibus on AI"), in force since 27 July 2026 — the Commission's stated reason was that neither industry nor the harmonised-standards bodies were ready, not that the obligations became less serious. That extra runway is real and worth using rather than banking on: the deferral is about infrastructure catching up, not about the underlying risk. If Ava's scope ever moved toward Annex III territory, the move is still to get the written legal position early, while there's time to act on it, not in late 2027 alongside everyone else filing at once.

*(Verified against current sources as of this writing — 10 September 2026 — since the deferral was adopted after this project's design work began. If you're reading this materially later, check whether anything has moved again; EU AI Act implementation dates have already changed once.)*

---

## NIST AI RMF as structure, not authority

The AI RMF is voluntary. It is used here because its four functions map onto a governance conversation a credit union board already knows how to have:

| Function | Where it lands in the lifecycle |
|---|---|
| **GOVERN** | Gate 5 (accountability, GOVERN 2.1, 3.2), the supplier controls (GOVERN 6.1, 6.2), and the tiering policy itself (GOVERN 1.3 — determining the level of risk management activity from risk tolerance) |
| **MAP** | Gate 1. MAP 1.1 for intended purpose and context, MAP 2.1 for the specific tasks performed. The tool permission list is the part most intake forms miss, and it is the part that makes an agent different from a model. |
| **MEASURE** | Gate 4. MEASURE 2.7 for the injection testing, 2.6 for regular safety evaluation, 2.10 for privacy, 2.8 for transparency and accountability. |
| **MANAGE** | Gate 6. MANAGE 4.1 for post-deployment monitoring, 2.4 for the kill switch, 2.3 for responding to previously unknown risks, 3.1 for third-party components — which is where a supplier model change lands. |

The subcategory references attached to each control in [control-library.md](control-library.md) are my own indicative mapping, not a conformance claim. Nobody is certified against the AI RMF; there is no such thing.

---

## What is deliberately not covered

**Sector-specific supervisory expectations.** A real credit union would also be answering to its prudential regulator on model risk management, and in the US that conversation runs through interagency model risk guidance rather than through anything AI-specific. That is a different project.

**Fairness and bias testing.** MEASURE 2.11 is not in the control set. For an agent that answers questions and executes an existing fee-waiver policy, the sharper risk is inconsistent application — some members talking their way into reversals that others do not get. The `quality-sampling` control is where that would surface, and if the sampled review showed reversal rates varying by member segment, it becomes a fairness problem quickly. It is a gap, and it is named here rather than hidden. It is also the same fact pattern that would put pressure on the Annex III reading above.

**Anything about the model's training.** Northbridge is a deployer using a hosted model. The provider's GPAI obligations under Articles 53 and 55 are the provider's. What Northbridge can govern is the contract (`vendor-terms`), the version pin (`model-change`) and what it sends (`pii-redaction`) — which is the honest boundary of a deployer's control.

---

*Northbridge Credit Union and Ava are fictional. Nothing here is legal advice.*

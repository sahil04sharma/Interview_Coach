# 09 — Orchestration Pipeline

> Exactly when each agent runs, when it is skipped, the fallback ordering, and how the Director → Planner → Generator chain replaces the current `questionIndex % intents.length` selection in `server/src/routes/session.js`. Wall of gates below is the schedule the orchestrator implements.
>
> **Preferred runtime (opt-in):** when `INTELLIGENCE_BRAIN=true`, answer-turn agents fuse into one Interview Brain call — see [future-concerns/02-interview-brain-consolidation.md](../future-concerns/02-interview-brain-consolidation.md). Multi-call schedule below remains the fallback.

## Where the orchestrator sits

Route handlers stop calling `buildInterviewerMessages`/`buildEvaluatorMessages` directly and instead call an orchestrator function per phase. The orchestrator owns agent scheduling, evidence merging, CCM persistence, and fallback. The V1 builders remain as the orchestrator's fallback path.

```
session.js route  ->  orchestrator.{start|answer|finish}()  ->  agents  ->  CCM
```

## Phase A — `POST /session/start`

```
1. Load user, resume, target role, JD, company style, curriculum (as V1 does today).
2. Run Resume Analyst (1 LLM call).
      success -> create CognitiveModel; persist ResumeClaim[], seed Hypothesis[], Uncertainty[]
      failure -> skip; CCM initialized empty; resumeClaims empty (== V1)
3. Director selects the FIRST objective (may be "cover-required" / warm-up).
      failure -> fallback intent = intents[0]
4. Planner -> Generator produce Q1.
      failure -> V1 buildInterviewerMessages
5. Persist currentQuestion (existing field) + optional questionPlan.
```

LLM calls at start: 1 (Resume Analyst) + 1 (Director+Planner fused) + 1 (Generator) = ~3. Resume Analyst is cached for the session.

## Phase B — `POST /session/:id/answer` (the hot path)

Runs on every submitted answer. Ordering matters: evaluate first (gather evidence), then decide (Director), then generate.

```
1. Persist raw answer + delivery metrics (fillerWordCount, wpm, speakingSeconds) as today.

2. EVALUATE (parallel where possible):
   2a. Technical Evaluator      (always, 1 call)
   2b. Communication Evaluator  (always, 1 call)
   2c. Misconception Detector   (CONDITIONAL — see gate below)

3. EVIDENCE ENGINE:
   - convert agent outputs -> Evidence rows
   - attach evidence to ConceptBeliefs + dimensions
   - recompute score/confidence/verification (rules in 03 & 05)
   - propagate neighborhood influence via ConceptEdge (06)
   - reconcile Hypotheses & Uncertainties (05)
   - refresh Impressions
   - write legacy Question columns via mapping (07)
   - update UserConceptMastery (V1) + Session.memory (V1) for compatibility

4. DECIDE:
   - Interview Director reads CCM -> Objective (1 call, fused with Planner)
        failure -> V1 intent = intents[questionIndex % intents.length]
   - respect: follow-up budget (memory.followUpBudget), covered topics,
     required company/mode coverage, difficulty adaptation

5. GENERATE:
   - Question Planner -> QuestionPlan (fused into step 4 call)
   - Question Generator -> next question string (1 call)
        failure -> V1 buildInterviewerMessages

6. Persist: evaluation response (legacy + intelligence), next currentQuestion,
   updated CognitiveModel, coveredTopics.
```

### Misconception Detector gate

Run **only** when a misconception is plausible, to control cost:

```
run if:
     technical knowledge.score <= 6
  OR conceptsIncorrect.length > 0
  OR conceptsPartial.length > 0
  OR any commonly-confused-with edge touches a probed concept
else: skip (no misconception this turn)
```

### Follow-up vs new topic

- If the Director sets `followUp: true` and `memory.followUpBudget > 0`, the Planner targets the same concept at a sharper angle (mirrors V1 `forcedFollowUp`, but chosen strategically instead of by evaluator's `needsFollowUp`).
- Budget decrement reuses existing `updateMemoryAfterAnswer` follow-up accounting.

LLM calls per answer: 2 evaluators + 1 director/planner + 1 generator (+1 misconception when gated) = **4–5**.

## Phase C — `POST /session/:id/finish`

```
1. Ensure final CCM is current (run evaluators on last answer if pending).
2. Report Writer (1 call) reads CCM + hypotheses + evidence + transcript + growth.
      failure -> V1 buildVerdictMessages
3. Persist: legacy verdict fields (Session.hiringVerdict, hireProbability,
   readinessScore, strengths, weaknesses, recommendedPath, verdictReasoning,
   reportAnalysis) + optional intelligence.report.
4. Study plan generation (V1 buildStudyPlanMessages) now fed by richer
   weak-concept + misconception data.
5. Snapshot ProgressSnapshot (V1) using CCM growth trace.
```

## Fallback ordering (per stage)

Every stage tries V2, then falls back, and records degradation as metadata (never hidden):

| Stage | Try | Fallback |
|---|---|---|
| Start question | Director→Planner→Generator | `buildInterviewerMessages` |
| Evaluate | split evaluators | `buildEvaluatorMessages` (single call, split its fields) |
| Misconception | detector (gated) | skip |
| Next question | Director→Planner→Generator | `questionIndex % intents.length` + `buildInterviewerMessages` |
| Report | Report Writer | `buildVerdictMessages` |

A single agent failure never aborts the turn; the interview always returns a next question and an evaluation.

## Call-budget summary

| Phase | V1 calls | V2 calls (typical) |
|---|---|---|
| start | ~1–2 | ~3 |
| answer | ~2 (eval + next Q) | 4–5 |
| finish | ~2 (verdict + plan) | ~2–3 |

The premium is roughly +2 calls per answer for full strategic reasoning + knowledge/communication separation + misconception detection, with the most expensive agent (Misconception Detector) gated. This is the deliberate cost of intelligence stated in [02](02-architecture-overview.md).

## Concurrency & latency notes

- Technical + Communication evaluators are independent → run concurrently.
- Director/Planner can be one fused structured call to save a round-trip.
- Generator must run after the plan (sequential).
- Target added latency per turn: one extra sequential hop beyond V1 (evaluate ∥, then decide, then generate).

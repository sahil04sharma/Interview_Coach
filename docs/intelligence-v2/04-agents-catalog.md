# 04 — Agents Catalog

> The 8 specialist agents. Each has a single responsibility, strict structured I/O, and explicit "never-do" rules. Agents communicate only through structured objects on the Candidate Cognitive Model ([03](03-candidate-cognitive-model.md)) — never by reading each other's prose. Prompt contracts and full JSON schemas are in [07](07-prompts-and-json-schemas.md).

## Design contract for all agents

- **One job.** If an agent needs to do two conceptually different things, it is two agents.
- **Structured out only.** Every agent returns strict JSON matching its schema in [07](07-prompts-and-json-schemas.md). No free prose leaks between agents (the Report Writer is the only prose *product*, and it consumes structured input).
- **Evidence, not assertion.** Any judgment includes `confidence` and the reasoning/evidence that supports it.
- **Deterministic fallback.** Each agent names its V1 fallback so failure degrades gracefully.

## Summary table

| # | Agent | Runs | Consumes | Produces | Replaces / extends |
|---|---|---|---|---|---|
| 1 | Resume Analyst | start (+resume change) | resume text, target role, JD | resume claims, initial hypotheses | fills dead `resumeClaimsVerified` |
| 2 | Technical Evaluator | every answer | Q + answer + concepts | knowledge evidence | half of `buildEvaluatorMessages` |
| 3 | Communication Evaluator | every answer | Q + answer + delivery metrics | communication evidence | other half of `buildEvaluatorMessages` |
| 4 | Misconception Detector | conditional | Q + answer + concepts | misconception objects | new |
| 5 | Interview Director | every turn | full CCM | next objective | replaces `questionIndex % intents` |
| 6 | Question Planner | every turn | objective + CCM | question plan (spec) | new (between Director & Generator) |
| 7 | Question Generator | every turn | question plan | one question (prose) | `buildInterviewerMessages` prose role |
| 8 | Report Writer | finish | full CCM + transcript | explainable report | replaces `buildVerdictMessages` |

---

## 1. Resume Analyst

**Responsibility:** Turn the resume + target role + JD into structured, verifiable claims and seed initial hypotheses/uncertainties.

- **Input:** `resumeText` (from `User.resumeText`), `targetRole`, `jdText`, role curriculum.
- **Output:** `ResumeClaim[]`, seed `Hypothesis[]`, seed `Uncertainty[]`.
- **Runs:** once at `POST /session/start`; re-runs only if resume text changes.
- **Never does:** score answers, choose questions, judge communication. It only reads the resume, never a live answer.
- **Fallback:** none needed — if it fails, `resumeClaims` stays empty and the system behaves like V1 (which never populated it anyway).

Example output shape:
```json
{
  "claims": [
    { "claim": "Led migration to microservices", "conceptSlugs": ["microservices","service-decomposition"], "importance": "high" }
  ],
  "seedHypotheses": [
    { "statement": "Claims system-design leadership; verify depth vs buzzwords", "conceptSlugs": ["system-design"] }
  ]
}
```

## 2. Technical Evaluator

**Responsibility:** Judge *knowledge, understanding, reasoning, depth, terminology* of one answer. Knowledge only.

- **Input:** `questionText`, `userAnswer`, linked concepts, difficulty, language.
- **Output:** technical evidence — per-dimension scores (knowledge/understanding/reasoning/depth/terminology/architectureThinking/productionThinking), `conceptsCorrect/Partial/Incorrect`, `knowledgeGaps`, each with confidence + reason.
- **Runs:** every answered question.
- **Never does:** score communication, clarity, fluency, structure, or delivery. Must not reward eloquence or penalize plain/Hinglish phrasing (per `languageGuide`). Must not choose the next question.
- **Fallback:** V1 `buildEvaluatorMessages` technical fields.

## 3. Communication Evaluator

**Responsibility:** Judge *clarity, structure, terminology delivery, STAR completeness* to a human listener. Communication only.

- **Input:** `questionText`, `userAnswer`, delivery metrics (`fillerWordCount`, `wordsPerMinute`, `speakingSeconds`), language.
- **Output:** communication evidence — `communication`, `structure`, STAR dimensions, delivery notes, each with confidence + reason.
- **Runs:** every answered question.
- **Never does:** judge factual correctness or technical depth. A wrong-but-clear answer scores high here and low on knowledge — that divergence is a feature. Must respect language rules (no penalty for Hindi/Hinglish/accent).
- **Fallback:** V1 `buildEvaluatorMessages` communication/structure/STAR fields.

## 4. Misconception Detector

**Responsibility:** Identify confidently-held wrong beliefs (not mere gaps).

- **Input:** `questionText`, `userAnswer`, `conceptsIncorrect/Partial`, technical evidence.
- **Output:** `Misconception[]` (statement, correctStatement, candidate confidence, our confidence, status).
- **Runs:** conditionally — only when technical score is mid/low OR `conceptsPartial/conceptsIncorrect` is non-empty (gating per [09](09-orchestration-pipeline.md)). Skipped on clearly strong answers.
- **Never does:** score dimensions, choose questions. It flags, it does not grade.
- **Fallback:** skip; misconceptions simply remain undetected (V1 has none).

## 5. Interview Director

**Responsibility:** The brain. Read the whole CCM and decide the single most valuable *objective* for the next turn.

- **Input:** full CCM — dimensions, hypotheses, misconceptions, resume claims, open uncertainties, company weights (`CompanyStyle`), mode, difficulty, follow-up budget.
- **Output:** one `Objective` — type (verify hypothesis / reduce uncertainty / probe misconception / stretch strength / cover required area / behavioral), target concept(s), target hypothesis/uncertainty id, rationale, desired difficulty, whether a follow-up vs new topic.
- **Runs:** every turn.
- **Never does:** write question text, pick exact wording, or produce prose. Output is strategy, not a question.
- **Fallback:** V1 intent selection (`questionIndex % intents.length`).

Example output:
```json
{
  "objectiveType": "verify-hypothesis",
  "targetHypothesisId": "h_12",
  "targetConceptSlugs": ["redis-eviction"],
  "difficulty": "hard",
  "followUp": false,
  "rationale": "Redis depth claimed on resume but unverified; last answer was fluent but generic (low confidence). Probe eviction to confirm real experience."
}
```

## 6. Question Planner

**Responsibility:** Translate a fuzzy objective into a concrete, renderable question plan.

- **Input:** `Objective`, relevant `ConceptBelief`s, curriculum, covered topics, company style, language.
- **Output:** `QuestionPlan` — intent label, topic, target concept, expected concepts in a good answer, verification goal, difficulty, question type (from V1's `questionType` enum), STAR-required flag.
- **Runs:** every turn (may be fused into the Director LLM call to save one round-trip — see budget in [02](02-architecture-overview.md)).
- **Never does:** write the final natural-language question, or override the Director's chosen objective.
- **Fallback:** derive a minimal plan from V1 intent + curriculum.

## 7. Question Generator

**Responsibility:** Render one natural, human-sounding interview question from the plan, in the right language and interviewer voice.

- **Input:** `QuestionPlan`, language guide, company framing, previous questions (to avoid repeats), Emma persona tone.
- **Output:** one question string (plus optional brief setup), exactly like today's `buildInterviewerMessages` output so TTS/voice is unaffected.
- **Runs:** every turn.
- **Never does:** change topic/difficulty/intent, add a second question, or decide strategy. It only phrases the plan.
- **Fallback:** V1 `buildInterviewerMessages` with the fallback intent.

## 8. Report Writer

**Responsibility:** Produce the explainable end-of-interview report — narrate *why*, not just *what*.

- **Input:** full CCM, hypotheses (resolved/open), misconceptions, evidence, transcript, growth trace.
- **Output:** structured report + per-dimension narrative that traces hypothesis → probe → evidence → conclusion; hire verdict with reasoning; strengths/weaknesses each backed by evidence references; recommended learning path.
- **Runs:** `POST /session/:id/finish` only.
- **Never does:** invent conclusions without evidence links; assert a hire verdict without citing the evidence chain.
- **Fallback:** V1 `buildVerdictMessages`.

---

## Never-do matrix (separation of powers)

| Agent | Must never |
|---|---|
| Technical Evaluator | score communication/clarity/fluency; pick questions |
| Communication Evaluator | score correctness/knowledge; pick questions |
| Misconception Detector | assign dimension scores; pick questions |
| Interview Director | write question text; phrase anything |
| Question Planner | write final question; change the objective |
| Question Generator | choose topic/difficulty/strategy; add extra questions |
| Resume Analyst | read live answers; score anything |
| Report Writer | conclude without evidence links |

This matrix is the enforceable contract the implementation and reviews check against.

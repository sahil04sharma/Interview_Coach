# Interview Intelligence V2 — Design Index

> Status: DESIGN ONLY. No application code is produced by this package. These documents describe how to evolve the existing Interview Grove system into a reasoning-driven Interview Intelligence Engine without breaking the current interview loop.

## Purpose

The current system asks and scores questions well, but it does not *reason* about the candidate. V2 introduces a thinking layer that behaves like an experienced FAANG interviewer: it observes, forms hypotheses, gathers evidence, verifies, updates beliefs, reduces uncertainty, and only then chooses what to ask next.

The design goal is **intelligence, explainability, maintainability, extensibility, and production readiness** — not more LLM calls.

## Reading order

1. [01-gap-analysis.md](01-gap-analysis.md) — What exists today, what is shallow, what V2 fixes.
2. [02-architecture-overview.md](02-architecture-overview.md) — Layers, data flow, why the Director is separate from the Generator.
3. [03-candidate-cognitive-model.md](03-candidate-cognitive-model.md) — The "Candidate Mind" state model that replaces flat weak/strong topics.
4. [04-agents-catalog.md](04-agents-catalog.md) — The 8 specialist agents, their inputs/outputs, and hard boundaries.
5. [05-hypothesis-and-evidence.md](05-hypothesis-and-evidence.md) — Hypothesis lifecycle, evidence objects, certainty, uncertainty reduction.
6. [06-knowledge-graph-v2.md](06-knowledge-graph-v2.md) — Concept graph with prerequisite/related edges and neighborhood influence.
7. [07-prompts-and-json-schemas.md](07-prompts-and-json-schemas.md) — Per-agent prompt contracts and strict JSON schemas.
8. [08-database-and-apis.md](08-database-and-apis.md) — Additive Prisma models and API shapes (backward compatible).
9. [09-orchestration-pipeline.md](09-orchestration-pipeline.md) — Exact start / answer / finish pipelines and agent scheduling.
10. [10-folder-structure-and-decisions.md](10-folder-structure-and-decisions.md) — Proposed module layout and decision log.
11. [11-implementation-roadmap.md](11-implementation-roadmap.md) — Phased build order with acceptance criteria.
12. [12-human-interviewer-cognition.md](12-human-interviewer-cognition.md) — Psychological operating manual: how a world-class human interviewer thinks (the reasoning standard every agent must emulate).

## Compatibility contract (non-negotiable)

The following must keep working exactly as today after each V2 phase:

```
Resume -> Curriculum -> Question -> Answer -> Evaluate -> Memory -> Next Question
```

- `POST /session/start`, `POST /session/:id/answer`, `POST /session/:id/finish` keep their existing request/response fields. V2 only **adds** fields.
- Groq LLM, Whisper STT, and Orpheus TTS ("Emma") stay as the providers.
- Existing Prisma models (`User`, `Session`, `Question`, `Concept`, `UserConceptMastery`, `StudyPlan`, `ProgressSnapshot`, `QuestionConcept`, `CurriculumCache`, `CompanyStyle`) are **not dropped or renamed**. V2 adds tables/columns.
- Existing React screens keep functioning; new intelligence is surfaced through additive UI later.
- If any V2 agent fails, the system must fall back to the current V1 behavior for that turn (graceful degradation).

## Glossary

| Term | Meaning |
|------|---------|
| Candidate Cognitive Model (CCM) | The evolving "mind model" of the candidate: beliefs about their knowledge, communication, reasoning, etc., each with confidence and evidence. |
| Interview Director | The reasoning brain. Reads the CCM, decides the next interview *objective*. Never writes questions. |
| Objective | A strategic goal for the next turn (e.g. "verify claimed Redis depth", "reduce uncertainty on SQL indexing"). |
| Question Plan | A structured spec (intent, topic, difficulty, expected concepts, verification goal) produced from an objective. Not prose. |
| Hypothesis | A testable belief about the candidate (e.g. "memorized React, weak on internals"). |
| Evidence | A structured record supporting or contradicting a hypothesis, with source, strength, and interpretation. |
| Certainty / Verification status | How confident we are in a belief and whether it has been verified by targeted probing. |
| Specialist agent | A single-responsibility LLM (or deterministic) unit with strict input/output and "never-do" rules. |

## Non-goals for V2

- Not a chatbot; not free-form conversation.
- Not a rewrite: Express + Prisma + Vite remain.
- Out of scope entirely: video/emotion-from-camera, payments/billing, dark mode, external chart libraries, multi-tenant org features.
- Emotional signals are optional and inferred only from text/delivery evidence, never fabricated.

## Design tenets

1. **Knowledge != Communication.** These are scored by different agents and never blended.
2. **Every conclusion carries evidence + confidence.** No unsupported claims.
3. **Every question exists to prove or disprove something.** No filler questions.
4. **Separation of powers.** Director decides strategy; Generator writes prose; neither does the other's job.
5. **Selective compute.** Agents run only when they add signal; V1 paths remain as fallback.

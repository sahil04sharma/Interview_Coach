# 11 — Implementation Roadmap

> Phased build order for a later Agent session. Each phase is independently shippable, keeps the V1 loop working, and has explicit risk + acceptance criteria. No code is written in this docs-only step.

## Guiding principle

Ship the reasoning layer *behind fallbacks* so every phase is safe to deploy. Order: schema → evidence backbone → split evaluators → strategic questioning → explainable reports → richer UI. Each phase adds intelligence without removing the V1 path.

## Phase 0 — Design sign-off (this package)

- **Do:** review these 12 docs for the four review criteria (knowledge≠communication separation, hypothesis/evidence, explainable hire narrative, backward compatibility).
- **Acceptance:** a later session can implement Phase 1 without re-interpreting the brief.

## Phase 1 — Additive schema + CCM scaffold

- **Do:** add Prisma models from [08](08-database-and-apis.md) (`CognitiveModel`, `Hypothesis`, `Evidence`, `Misconception`, `ResumeClaim`, `Uncertainty`, `ConceptEdge`) + back-relations; one additive migration. Create `intelligence/cognitiveModel.js` read/write with V1 `Session.memory` fallback.
- **Risk:** migration on existing DB. **Mitigation:** all nullable/defaulted, reversible.
- **Acceptance:** migration applies and rolls back cleanly; existing sessions unaffected; a CCM row can be created/read/updated; `npm run dev` + full V1 interview still works end to end.

## Phase 2 — Evidence engine + split evaluators

- **Do:** implement Technical + Communication evaluators, `evidenceEngine.js`, legacy field mapping ([07](07-prompts-and-json-schemas.md)). Wire into `answer` behind a feature flag; still write `Question` legacy columns and `Session.memory`.
- **Risk:** score drift vs V1; double LLM cost. **Mitigation:** run evaluators concurrently; flag-gated; compare against V1 on a fixture set.
- **Acceptance:** knowledge and communication scores populated independently; a wrong-but-fluent fixture scores low knowledge + high communication; all legacy fields still present; fallback to `buildEvaluatorMessages` verified by forcing an agent error.

## Phase 3 — Resume Analyst + hypothesis engine

- **Do:** implement Resume Analyst at `start`; `hypothesisEngine.js`; populate `ResumeClaim`/`Hypothesis`/`Uncertainty`; reconcile them in the evidence loop.
- **Risk:** hallucinated claims. **Mitigation:** claims are candidates to *verify*, never asserted; low-confidence by default.
- **Acceptance:** `resumeClaims` populated (the dead `resumeClaimsVerified` concept is now real); at least one hypothesis transitions open→supported/refuted across a scripted session with evidence links.

## Phase 4 — Strategic questioning (Director → Planner → Generator)

- **Do:** implement the three agents + fused Director/Planner call; replace `questionIndex % intents.length` in `orchestrator` (keep it as fallback). Add Misconception Detector with its gate ([09](09-orchestration-pipeline.md)).
- **Risk:** worse question quality than V1; latency. **Mitigation:** fallback ordering; A/B against V1 on realism; fuse calls; concept-graph seeded minimally.
- **Acceptance:** every generated question logs the objective + rationale that produced it; Director never emits prose; Generator never changes topic/difficulty; forcing failures falls back to V1 questions; added latency ≈ one sequential hop.

## Phase 5 — Concept graph edges + neighborhood influence

- **Do:** seed `ConceptEdge` for core domains; implement `conceptGraph.js` propagation ([06](06-knowledge-graph-v2.md)); feed Director prerequisite sequencing + Misconception priors.
- **Risk:** runaway/incorrect propagation. **Mitigation:** damping, single-hop, influence adjusts confidence only (never verifies).
- **Acceptance:** failing a concept lowers confidence on its prerequisites (inferred, tagged unverified); empty edge table is a valid no-op.

## Phase 6 — Explainable Report Writer

- **Do:** implement Report Writer at `finish` ([07](07-prompts-and-json-schemas.md)); keep legacy verdict fields; feed richer study plan.
- **Risk:** conclusions without evidence. **Mitigation:** schema requires `evidenceIds` on strengths/weaknesses/dimensions; validator rejects empty links.
- **Acceptance:** report narrates hypothesis→probe→evidence→conclusion per dimension; every strength/weakness cites evidence; legacy report UI still renders; fallback to `buildVerdictMessages` verified.

## Phase 7 — Intelligence UI surfaces

- **Do:** add read-only `GET /session/:id/cognitive-model` + `/hypotheses`; surface dimension confidence, hypothesis chains, and misconception cards in the report/progress screens (preserving the warm-light design system).
- **Risk:** UI clutter. **Mitigation:** progressive disclosure; one job per section.
- **Acceptance:** users can see *why* a verdict was reached; existing screens unchanged unless intentionally enhanced.

## Cross-cutting acceptance (every phase)

1. V1 interview loop works with V2 flag off.
2. Any single agent failure degrades to the V1 path for that stage (no aborted turns).
3. All existing `Session`/`Question` columns and API response fields remain populated.
4. LLM-call budget stays within the targets in [02](02-architecture-overview.md)/[09](09-orchestration-pipeline.md).

## Out of scope (unchanged from brief)

No Prisma migrations, agent code, prompt wiring, or UI changes in *this* docs step. Video/camera, payments, dark mode, and external chart libraries remain out of scope for V2 entirely.

## Post Phase 7 — future concerns

After Phases 1–7, see [future-concerns/](../future-concerns/00-index.md) for LLM budget, latency, cost, and optimization work (not blockers for shipping phases).

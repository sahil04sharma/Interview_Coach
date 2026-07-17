# 10 — Folder Structure & Decision Log

> Proposed module layout for the reasoning layer and the design decisions (with the "why superior" rationale) behind them. Fits inside the existing `server/src/` structure without reshuffling current files.

## Current server layout (for reference)

```
server/src/
  index.js
  llm.js                      # Groq client
  db.js                       # Prisma client
  prompts.js                  # all V1 prompt builders (kept as fallback)
  answerQuality.js            # delivery metrics
  fallbackQuestions.js
  curriculumCache.js
  speech.js  speechFormatter.js  wavConcat.js  pdf.js
  routes/    session.js user.js auth.js voice.js code.js knowledge.js studyPlan.js companyStyles.js
  services/  interviewMemory.js evaluationService.js knowledgeService.js studyPlanService.js
```

## Proposed additive layout

New reasoning layer lives under `server/src/intelligence/`. Nothing existing moves.

```
server/src/
  intelligence/
    orchestrator.js           # start/answer/finish scheduling + fallback (09)
    cognitiveModel.js         # CCM read/update/persist (03)
    evidenceEngine.js         # evidence -> belief updates, confidence math (05)
    hypothesisEngine.js       # hypothesis lifecycle + uncertainty scoring (05)
    conceptGraph.js           # ConceptEdge traversal + neighborhood influence (06)
    agents/
      resumeAnalyst.js
      technicalEvaluator.js
      communicationEvaluator.js
      misconceptionDetector.js
      interviewDirector.js
      questionPlanner.js
      questionGenerator.js
      reportWriter.js
    prompts/                  # V2 prompt strings, one per agent (07)
      resumeAnalyst.prompt.js
      technicalEvaluator.prompt.js
      ...
    schemas/                  # JSON schema validators per agent (07)
      index.js
    fallback.js               # thin adapters to V1 prompts.js builders
  prompts.js                  # UNCHANGED — used by fallback.js
```

### Why this shape

- **`agents/` = one file per agent** mirrors the one-responsibility rule in [04](04-agents-catalog.md); each file exports a single `run(input) -> validated output`.
- **`prompts/` separated from `agents/`** so prompt wording can be versioned/tuned without touching orchestration logic (addresses the future "prompt versioning" item in `docs/06-roadmap.md`).
- **`schemas/` centralizes validation** so every agent output is parsed the same way with the same fallback trigger.
- **`fallback.js` wraps the existing `prompts.js`** builders, so V1 remains the single source of fallback truth — no duplicated prompt logic.
- **`orchestrator.js` is the only thing `routes/session.js` imports**, keeping the route thin and the reasoning testable in isolation.

## Decision log

| # | Decision | Alternative rejected | Why superior |
|---|---|---|---|
| D1 | Separate Director from Generator | one prompt picks strategy + writes question (V1) | strategy becomes inspectable/replayable; cheap prose model stays cheap; no goal competition inside one generation |
| D2 | Split technical vs communication evaluators | one evaluator scores both (V1) | eliminates halo effect; a wrong-but-fluent answer scores correctly on each axis; enforces knowledge≠communication tenet |
| D3 | Every belief carries confidence + evidence | scalar EMA `masteryScore` | supports "unsure," verification, and explainable reports; drives uncertainty-reduction strategy |
| D4 | Hypothesis-driven question selection | `questionIndex % intents.length` | questions gain purpose; report can narrate why each was asked |
| D5 | Additive DB + CCM alongside `Session.memory` | migrate/replace memory blob | zero-risk rollback; graceful degradation; ships incrementally |
| D6 | Gate Misconception Detector | run every turn | controls LLM cost; it only adds signal when a misconception is plausible |
| D7 | Fuse Director + Planner into one call | three separate calls | saves a round-trip while keeping outputs structurally separate |
| D8 | Typed `ConceptEdge` beside the tree | overload `parentId` | enables prerequisite sequencing + related influence without breaking hierarchy |
| D9 | Legacy field mapping in every agent output | new-only schema | existing `Question`/`Session` columns and UI keep working untouched |
| D10 | Prose only from Report Writer | agents exchange prose | prevents ambiguity leakage; all inter-agent data is structured/validated |

## Testing seams (design intent)

- Each agent is pure `input -> output`, unit-testable with fixture transcripts.
- `evidenceEngine`/`hypothesisEngine` are deterministic given evidence → unit-testable without LLM.
- `orchestrator` testable with mocked agents to assert the fallback ordering in [09](09-orchestration-pipeline.md).

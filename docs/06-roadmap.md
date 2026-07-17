# 06 — Roadmap & Out of Scope

## Phase 1 foundation (shipped)

- Concept-level knowledge graph (`Concept`, `UserConceptMastery`, `QuestionConcept`)
- Session Interview Memory (JSON on `Session.memory`) driving adaptive next questions
- Richer evaluator dimensions + hire probability / readiness on finish
- Study plan generation + Knowledge Base / Study Plan screens
- Structured company modes (weights + philosophy)
- Warm-light Inter-based UI

## Intelligence V2 (design complete)

The multi-agent reasoning architecture is now fully designed under
[`intelligence-v2/`](intelligence-v2/00-index.md) — cognitive model, 8 specialist
agents, hypothesis/evidence engine, concept-graph edges, prompts/schemas, additive
DB/APIs, orchestration, and a phased roadmap. This supersedes the "multi-agent
deferred" note below **for planning purposes only** (still no code shipped yet).

## Explicitly deferred

- Dark mode
- Video / camera analysis
- GitHub/LinkedIn/portfolio analyzers
- Multi-agent architecture (now designed in `intelligence-v2/`, implementation pending)
- Chart libraries / heavy analytics dashboards
- Payment / billing flows
- Full repository-pattern rewrite of every route

## Future work

1. Spaced-repetition scheduling on study plan items
2. Richer concept edges (`prerequisite` / `related`) beyond parent tree
3. Dark mode toggle
4. Coding mode with sandboxed execution polish
5. Prompt versioning per company style
6. Export study plans as PDF/Markdown

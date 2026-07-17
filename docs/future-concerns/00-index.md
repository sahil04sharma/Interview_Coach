# Future Concerns — Index

> Items to revisit **after Intelligence V2 Phases 1–7 are complete**. Optimization, curriculum product evolution, cost, and ops follow-ups.

## When to use this folder

- All core V2 phases are done and the feature flag (`INTELLIGENCE_V2`) has been validated in production.
- You want to reduce latency, LLM cost, or rate-limit pressure without losing reasoning quality.
- You are evolving from one-off mocks → lifelong role mastery (curriculum + progress graph).
- You are planning model routing, caching, or call-budget refactors.

## Documents

| # | Topic | Status |
|---|--------|--------|
| [01-v2-llm-budget-and-latency.md](01-v2-llm-budget-and-latency.md) | V1 vs V2 call count, latency, Groq cost baselines | Baseline metrics |
| [02-interview-brain-consolidation.md](02-interview-brain-consolidation.md) | Fuse logical agents into one Interview Brain call | **Implementing** — `INTELLIGENCE_BRAIN=true` |
| [03-lifelong-role-curriculum.md](03-lifelong-role-curriculum.md) | **Product evolution:** global role curriculum + user progress graph + planner | **Implementing D2** — planner wired; `ROLE_CURRICULUM_V1` |

## Related design docs

- [intelligence-v2/11-implementation-roadmap.md](../intelligence-v2/11-implementation-roadmap.md) — Phases 1–7 (complete)
- [intelligence-v2/02-architecture-overview.md](../intelligence-v2/02-architecture-overview.md) — original LLM budget philosophy
- [intelligence-v2/09-orchestration-pipeline.md](../intelligence-v2/09-orchestration-pipeline.md) — multi-call / Brain scheduling

# 01 — V2 LLM Budget, Latency & Cost

> **Status:** Future work — address after Intelligence V2 Phases 1–7 are complete.  
> **Trigger:** `INTELLIGENCE_V2=true` is stable in production and users report slow turns or you hit Groq rate limits.  
> **Preferred optimization:** [02-interview-brain-consolidation.md](02-interview-brain-consolidation.md) (`INTELLIGENCE_BRAIN=true`) — fuse answer-turn agents into one LLM call.

## Summary

V2 adds a reasoning layer on top of V1. The same HTTP APIs (`POST /session/start`, `POST /session/:id/answer`, `POST /session/:id/finish`) are used. The difference is **how many LLM calls** run per step when `INTELLIGENCE_V2=true` in `server/.env`.

V1 remains the safe default (`INTELLIGENCE_V2=false`). V2 is opt-in via feature flag so production can ship code before enabling the heavier call pattern.

---

## V1 vs V2 — what changes

| Area | V1 | V2 |
|------|----|----|
| Session start | 1 question LLM call | + Resume Analyst; Director + Generator for Q1 |
| Per answer | 1 monolithic evaluator | 3 parallel evaluators (Tech + Comm + V1 coaching supplement) |
| Weak answers | — | +0–1 Misconception Detector |
| Next question | 0–1 LLM (can reuse evaluator `followUpQuestion`) | Always Director + Generator (no V1 follow-up shortcut) |
| Finish | Verdict + study plan | Same today (Phase 6 may add Report Writer) |

**Fallback:** If any V2 agent fails for a step, that step falls back to V1 behavior for that turn.

---

## LLM call count (typical 8-question session)

Assumptions: resume + JD provided, curriculum cache hit, ~50% of answers trigger misconception detection.

### Shared (both V1 and V2)

| When | Call | Condition |
|------|------|-----------|
| Start | JD extract | If job description provided |
| Start | Role curriculum | Cache miss only |
| Finish | Hiring verdict | Always |
| Finish | Study plan | Always |

Voice (Whisper STT, Orpheus TTS) is separate from chat LLM calls.

### Per-phase totals

| Phase | V1 calls | V2 calls |
|-------|----------|----------|
| Start | ~1–3 | ~3–5 (+ resume) |
| 7 answer turns | ~7–14 | ~35–42 |
| Finish | 2 | 2 |
| **Session total** | **~18** | **~44** |

V2 is roughly **2.5–3× more LLM calls** per session than V1.

---

## Latency — parallel vs sequential

### `POST /session/start`

```
V1:  [Question LLM]

V2:  [Resume Analyst] → [Director] → [Generator]
     (sequential; Generator can stream tokens to client)
```

| | V1 | V2 |
|---|----|----|
| Start (cache hit, no JD) | ~2–4 sec | ~5–10 sec |
| + Resume analysis | — | +3–6 sec |

### `POST /session/:id/answer`

```
V1:  [Evaluator] → (optional 0 LLM follow-up) OR [Question LLM]

V2:  [Tech Eval ─┐
      Comm Eval ─┼─ Promise.all (parallel)
      V1 Eval   ─┘]
           ↓
      [Misconception?]  ← sequential, gated
           ↓
      [Director] → [Generator]
```

| | V1 | V2 |
|---|----|----|
| Per answer (typical) | ~3–6 sec | ~8–14 sec |
| Full session LLM wait | ~40–50 sec | ~90–110 sec |

Streaming improves **perceived** speed for question text, but the server still waits for all agents before returning `done`.

### `POST /session/:id/finish`

Same in V1 and V2 today: ~4–8 sec (verdict + study plan). Phase 6 Report Writer will increase this.

---

## Groq cost estimate (`llama-3.3-70b-versatile`)

Pricing (Groq on-demand, mid-2026): **$0.59 / 1M input tokens**, **$0.79 / 1M output tokens**.

All agents currently share `LLM_MODEL` from `server/.env` — no cheaper routing per agent yet.

| | V1 | V2 |
|---|----|----|
| Cost per 8-Q session | ~**$0.02** | ~**$0.06** |
| Cost per 100 sessions | ~$2 | ~$6 |
| Cost per 1,000 sessions | ~$17 | ~$60 |

At low volume, **latency and rate limits** matter more than dollar cost.

---

## Rate-limit risk

V2 fires **3 parallel** evaluator calls per answer. On Groq free or low tiers this can cause:

- HTTP 429 rate limits
- Retries and failed turns (mitigated by V1 fallback per agent, but UX degrades)

V1 is gentler: mostly one LLM call at a time per user.

---

## Code references (current implementation)

| Concern | File |
|---------|------|
| Feature flag | `server/src/intelligence/cognitiveModel.js` — `isIntelligenceV2Enabled()` |
| Split eval + misconception | `server/src/intelligence/evaluateAnswer.js` |
| Director → Generator | `server/src/intelligence/generateNextQuestion.js` |
| V1 follow-up bypass (V2 off only) | `server/src/routes/session.js` — `shouldAskFollowUp()` |
| LLM client | `server/src/llm.js` |

---

## Optimization backlog (post Phase 7)

> **Preferred architectural path (2026-07-16):** fuse answer-turn agents into a single **Interview Brain** call while keeping logical modules. See [02-interview-brain-consolidation.md](02-interview-brain-consolidation.md). Do not implement until that proposal is approved.

The items below remain useful as incremental fallbacks if Brain is deferred, or as complementary work (metrics, context pruning).

### High impact

1. **Interview Brain consolidation (preferred)** — one LLM call per answer turn. **See doc 02.**

2. **Remove duplicate V1 evaluator in V2 path**  
   Today V2 runs Technical + Communication + full V1 evaluator in parallel. Extract coaching-only fields into Brain `coaching` section or smaller supplement.  
   **Saves:** ~1 LLM call per answer on multi-call path.

3. **Model routing per agent**  
   Use a smaller/faster model for Director, Misconception Detector, and Question Generator; keep 70B for evaluators only. Less relevant once Brain fuses calls; may still apply to Resume Analyst / Report Writer.  
   **Saves:** latency + cost on multi-call path.

4. **Parallelize start pipeline**  
   Run Resume Analyst concurrently with curriculum load where safe.  
   **Saves:** ~3–6 sec on session start.

5. **Re-enable smart follow-ups in V2**  
   When Director sets `followUp: true`, skip redundant planning on the next turn if plan is committed. Brain path already includes Director+Generator in one call.  
   **Saves:** 1 LLM call on follow-up turns (multi-call path).

### Medium impact

6. **Misconception batching** (multi-call path) / always-in-Brain with empty array when N/A.

7. **Director / Brain context pruning** — Context Builder caps (required for Brain).

8. **Response caching** — curriculum/JD already partially cached.

9. **Request queue / concurrency limit** — less critical once Brain is 1-call-per-turn.

### Observability (do first / with Brain)

10. **Per-turn LLM metrics** — call count, model, input/output tokens, wall time.

11. **Cost dashboard** — aggregate tokens per session/user.

---

## Acceptance criteria (when this concern is “done”)

- [ ] V2 answer turn p95 latency ≤ 8 sec (or documented trade-off if higher quality requires more).
- [ ] V2 session LLM cost ≤ 4× V1 (target; ideally ~2× after optimizations).
- [ ] No 429 rate-limit failures under expected concurrent user load.
- [ ] Per-agent model routing documented in `.env.example`.
- [ ] Metrics logged for every LLM call in the intelligence pipeline.

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-07-16 | Ship V2 behind `INTELLIGENCE_V2` flag; defer cost/latency optimizations until after Phase 7. Documented call budget and estimates in this file. |
| 2026-07-16 | Preferred optimization path: Interview Brain consolidation ([02](02-interview-brain-consolidation.md)). Design-only pending approval. |

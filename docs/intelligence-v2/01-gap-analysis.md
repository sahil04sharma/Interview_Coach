# 01 — Gap Analysis: Current System vs V2

> Grounded in the current codebase: `server/src/prompts.js`, `server/src/services/interviewMemory.js`, `server/src/routes/session.js`, and `server/prisma/schema.prisma`. Every gap below maps to a concrete file/model.

## What works today (keep it)

The V1 loop is genuinely good and must be preserved:

- **Curriculum generation** — `buildRoleCurriculumMessages()` builds a wide topic map (core/advanced/trick/recruiter) per role, cached in `CurriculumCache`. Keep.
- **Adaptive difficulty** — `updateMemoryAfterAnswer()` nudges `memory.difficulty` up/down from a rolling answer average. Keep.
- **Multi-dimensional evaluation** — `buildEvaluatorMessages()` already returns technical/communication/depth/structure/accuracy/problemSolving/practical/production/confidence + STAR + concepts. Keep as an evidence source.
- **Concept mastery** — `Concept`, `UserConceptMastery` (EMA `masteryScore`, `status`), and `QuestionConcept` provide a real concept graph and cross-session profile via `formatKnowledgeProfile()`. Keep and extend.
- **Company modes** — `CompanyStyle` with weights (`behavioralWeight`, `codingWeight`, `systemDesignWeight`) already biases prompts. Keep.
- **Voice + language** — Whisper STT, Orpheus TTS ("Emma"), and English/Hindi/Hinglish `languageGuide()`. Keep untouched.

V2 does not throw any of this away. It adds a reasoning layer that *consumes* these outputs as evidence.

## Gaps V2 fixes

### Gap 1 — Question intent is mechanical, not strategic

Today the next-question intent is chosen by array modulo:

```159:166:server/src/prompts.js
  let intent = intents[questionIndex % intents.length];
  if (practicePack === 'behavioral_star') intent = 'RECRUITER_SOFT / BEHAVIORAL STAR — require a real story with impact';
  if (practicePack === 'fundamentals') intent = 'ROLE_FUNDAMENTAL';
  if (practicePack === 'tricks') intent = 'TRICK_OR_EDGE';
```

A real interviewer picks the next question *because of what they just learned*, not because it is turn number 3. There is no notion of an objective, a hypothesis to test, or uncertainty to reduce.

**V2 fix:** the Interview Director ([04](04-agents-catalog.md)) chooses an *objective* from the cognitive model; the Question Planner turns it into an intent plan; the Generator writes prose. `questionIndex % intents.length` is replaced by Director output. See [09](09-orchestration-pipeline.md).

### Gap 2 — One monolithic evaluator blends knowledge and communication

`buildEvaluatorMessages()` scores `technicalScore` and `communicationScore` in the same call with the same context. A single LLM pass is prone to halo effects — a fluent answer inflates the technical score and vice versa.

**V2 fix:** split into a Technical Evaluator (knowledge/reasoning only) and a Communication Evaluator (clarity/structure/delivery only), with explicit "never score the other dimension" rules. Their outputs become independent evidence. See [04](04-agents-catalog.md) and design tenet #1.

### Gap 3 — Memory is a shallow blob; some fields are never written

`Session.memory` (Json) holds a flat structure from `emptyMemory()`:

```20:40:server/src/services/interviewMemory.js
export function emptyMemory({ difficulty = 'medium' } = {}) {
  return {
    difficulty,
    confidenceLevel: 5,
    topicsCovered: [],
    weakTopics: [],
    strongTopics: [],
    ...
    resumeClaimsVerified: [],
```

`resumeClaimsVerified` is declared and rendered into prompts but never populated by any writer — there is no Resume Analyst, so the array stays empty. Memory tracks *what happened* (topics covered, last scores) but not *what we believe and how sure we are*.

**V2 fix:** the Candidate Cognitive Model ([03](03-candidate-cognitive-model.md)) replaces the flat blob with belief objects that carry confidence, evidence, and verification status. Resume claims become first-class hypotheses populated by the Resume Analyst.

### Gap 4 — Mastery is a scalar EMA, not a belief with evidence

`UserConceptMastery.masteryScore` is a single float updated by exponential moving average. It cannot express "I think they're strong but I'm not sure" or "this was confidently wrong (a misconception) vs simply unknown."

**V2 fix:** every belief carries `confidence` and `verificationStatus` distinct from the score itself, plus links to the evidence that produced it. See [03](03-candidate-cognitive-model.md) and [05](05-hypothesis-and-evidence.md). The scalar `masteryScore` stays for backward compatibility.

### Gap 5 — Concept graph is parent/child only

```124:139:server/prisma/schema.prisma
model Concept {
  ...
  parentId      String?
  parent        Concept?             @relation("ConceptTree", fields: [parentId], references: [id])
  children      Concept[]            @relation("ConceptTree")
```

There are no `prerequisite` or `related` edges, so the system cannot reason "they failed TTL, so eviction and cache invalidation are probably also shaky" or "they can't understand indexing without understanding B-trees first."

**V2 fix:** add a `ConceptEdge` join table with typed edges and neighborhood-influence rules. See [06](06-knowledge-graph-v2.md).

### Gap 6 — No hypotheses, no evidence, no uncertainty

Nothing in the system says "hypothesis: candidate memorized React but doesn't understand internals" and then designs a question to confirm/deny it. Conclusions in reports (`buildVerdictMessages()`) are asserted, not traced to evidence.

**V2 fix:** the hypothesis/evidence engine ([05](05-hypothesis-and-evidence.md)) makes every belief testable, evidence-backed, and confidence-scored; the Report Writer explains *why*.

### Gap 7 — Reports state conclusions without explaining reasoning

`buildVerdictMessages()` returns strengths/weaknesses/verdict as lists. It reads like a scorecard, not like an interviewer's debrief ("I doubted their caching depth after Q2, probed it in Q4, and confirmed the gap").

**V2 fix:** the Report Writer ([04](04-agents-catalog.md)) narrates the interview: hypothesis → probe → evidence → conclusion, per dimension.

### Gap 8 — Multi-agent architecture was explicitly deferred

`docs/06-roadmap.md` lists "Multi-agent architecture" and "Richer concept edges (prerequisite/related)" under deferred/future work. This package supersedes that deferral **for planning purposes only** — still no code in this step.

## Mapping table

| Concern | Today (file) | V2 target |
|---|---|---|
| Next question strategy | `questionIndex % intents.length` (`prompts.js`) | Director → Planner → Generator ([09](09-orchestration-pipeline.md)) |
| Knowledge vs communication | one `buildEvaluatorMessages` call | split evaluators ([04](04-agents-catalog.md)) |
| Candidate state | `emptyMemory()` flat JSON (`interviewMemory.js`) | Candidate Cognitive Model ([03](03-candidate-cognitive-model.md)) |
| Resume verification | `resumeClaimsVerified` never written | Resume Analyst emits claim-hypotheses ([04](04-agents-catalog.md)) |
| Belief certainty | scalar `masteryScore` EMA | score + confidence + verificationStatus ([05](05-hypothesis-and-evidence.md)) |
| Concept relationships | parent/child only (`Concept`) | `ConceptEdge` prerequisite/related ([06](06-knowledge-graph-v2.md)) |
| Final report | `buildVerdictMessages` lists | explainable narrative ([04](04-agents-catalog.md)) |

## Migration principle

Each gap is closed **additively**: new tables/columns and new agent modules sit beside the current ones. If an agent is disabled or fails, the corresponding V1 path (`buildInterviewerMessages`, `buildEvaluatorMessages`, `updateMemoryAfterAnswer`) still runs. See the compatibility contract in [00-index.md](00-index.md).

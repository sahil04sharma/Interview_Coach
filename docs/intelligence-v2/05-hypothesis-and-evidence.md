# 05 — Hypothesis & Evidence Engine

> The mechanism that makes the interview *reasoned* rather than *scripted*. Every question exists to prove or disprove a hypothesis; every conclusion is backed by evidence with confidence and alternative interpretations.

## Core idea

A real interviewer does not run down a checklist. They form a theory about the candidate, design a question to test it, read the answer as evidence, and update the theory. V2 models this loop explicitly:

```
Hypothesis  ->  Objective (Director)  ->  Question (Planner+Generator)
     ^                                              |
     |                                              v
 update belief  <-  Evidence Engine  <-  Answer + Evaluators
```

## Hypothesis object

```typescript
interface Hypothesis {
  id: string;
  statement: string;          // "Candidate memorized React APIs but lacks internals understanding"
  conceptSlugs: string[];
  origin: 'resume-analyst' | 'evaluator' | 'misconception-detector' | 'director';
  status: 'open' | 'supported' | 'refuted' | 'inconclusive';
  confidence: number;         // 0..1 belief that the hypothesis is TRUE
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  createdTurn: number;
  lastTestedTurn: number | null;
  priority: number;           // 0..1 how worth testing now
}
```

### Lifecycle

```
open ──test──> supported   (confidence high, consistent evidence)
   │           refuted      (contradicting evidence dominates)
   │           inconclusive (mixed/weak evidence after budgeted probes)
   └──abandoned when priority drops below threshold or budget exhausted
```

- A hypothesis becomes `supported`/`refuted` only after at least one *targeted* probe (verification), not from incidental mentions.
- `inconclusive` is a valid terminal state — the report says "could not verify," which is more honest than guessing.
- Priority decays as a hypothesis is tested and as the session's question budget shrinks.

## Evidence object

Every evaluator/detector output is stored as evidence, addressable by id and linked from beliefs/hypotheses.

```typescript
interface Evidence {
  id: string;
  turn: number;
  questionId: string;         // links to Question row
  source: 'technical-evaluator' | 'communication-evaluator'
        | 'misconception-detector' | 'resume-analyst';
  observation: string;        // "Explained cache TTL correctly but couldn't explain eviction policy"
  dimension?: DimensionKey;   // which belief it informs
  conceptSlugs: string[];
  polarity: 'supports' | 'contradicts' | 'neutral';
  strength: number;           // 0..1 how strong this evidence is
  confidence: number;         // 0..1 how reliable the observation is
  alternativeInterpretations: string[]; // e.g. ["May have been nervous, not ignorant"]
}
```

Two independent numbers matter: **strength** (how much this moves a belief) and **confidence** (how much we trust the observation itself). A brilliant answer under a possibly-leaked question is high-strength but lower-confidence.

## Alternative interpretations (anti-overconfidence)

Every piece of evidence must record at least a considered alternative when one is plausible. This prevents the classic interviewer failure of over-reading one data point:

- "Vague answer" → alt: "nervous / warming up / misread the question"
- "Very fluent answer" → alt: "rehearsed talking point, not deep understanding"
- "Silence" → alt: "thinking carefully" vs "doesn't know"

Alternatives lower the evidence's `confidence` and can spawn a *new* hypothesis to disambiguate (e.g. re-probe the same concept from a different angle).

## Confidence update rule

When new evidence `e` arrives for a belief/hypothesis with current confidence `c`:

```
weight        = e.strength * e.confidence
if e.polarity == supports:    c' = c + (1 - c) * weight
if e.polarity == contradicts: c' = c * (1 - weight)
```

- Agreement pushes confidence toward 1 with diminishing returns.
- Contradiction multiplicatively erodes it (one strong contradiction matters a lot).
- `verification` flips to `verified` only when a *targeted probe* produced consistent supporting evidence and `c'` crosses a threshold (e.g. 0.75).

## Uncertainty reduction as the interview objective

The Director treats the interview as a search that maximizes information gain per remaining question:

```
value(objective) =
    uncertainty.priority
  * expectedConfidenceGain(objective)
  * companyWeight(objective.conceptSlugs)   // from CompanyStyle
  - costPenalty(repeat/coveredTopic)
```

The Director picks the objective with the highest value, subject to:
- required coverage (mode + company weights must be satisfied before finish),
- follow-up budget (`memory.followUpBudget`) for drill-downs,
- avoiding already-covered narrow topics (`Session.coveredTopics`).

This directly replaces the mechanical `questionIndex % intents.length` selection.

## Worked example (one hypothesis end-to-end)

1. **Resume Analyst** reads "Built Redis caching for 10k rps" → creates `Hypothesis h_12: "Redis experience is real and deep"`, `confidence 0.5`, and `Uncertainty u_3` linked to it.
2. **Director** (turn 3): highest-value objective = verify `h_12`. Emits `verify-hypothesis` objective on concept `redis-eviction`.
3. **Planner/Generator** ask: "You mentioned a Redis layer at 10k rps — when memory filled up, how did you decide what to evict?"
4. Answer is fluent about TTL but wrong about eviction policy.
5. **Technical Evaluator** → evidence `supports gap`, strength 0.7. **Misconception Detector** → misconception "thinks TTL and eviction are the same," ourConfidence 0.6.
6. **Evidence Engine** updates `h_12`: contradicting evidence dominates → `confidence` drops to ~0.25 → status `refuted` (claim likely shallow). `u_3` → `resolved`.
7. **Report Writer** narrates: "Claimed deep Redis experience. Probed eviction on Q4; candidate conflated TTL with eviction policy, suggesting usage without operational depth. Verdict weighted accordingly."

That chain — claim → doubt → probe → evidence → conclusion — is exactly what V1 cannot produce and what makes V2 reports explainable.

## Persistence

Hypotheses, evidence, and uncertainties are stored in additive tables ([08](08-database-and-apis.md)) and referenced by id from the CCM. Evidence rows link back to `Question.id`, so the report can cite the exact turn.

# 03 — Candidate Cognitive Model (CCM)

> The "mind model" of the candidate. Replaces the flat `emptyMemory()` blob (`server/src/services/interviewMemory.js`) and the scalar `UserConceptMastery.masteryScore` with a structured, evidence-backed, uncertainty-aware belief state.

## What it is

The CCM is the interviewer's evolving mental picture of *this specific candidate*: what they know, how well they reason, how clearly they communicate, what they believe incorrectly, how confident they are, and — critically — how sure *we* are about each of those judgments. It is the single source of truth the Interview Director reads to decide the next move and the Report Writer reads to explain the outcome.

It exists at two scopes:
- **Session CCM** — resets/initializes per interview, persisted on the session (supersedes `Session.memory`).
- **Cross-session CCM** — durable per-user beliefs, backed by concept mastery (supersedes/extends `UserConceptMastery`).

## Design rules

1. **Every belief is a structured object, never a bare value.** A belief has a value *and* a confidence *and* the evidence that produced it *and* a verification status.
2. **Knowledge and communication are separate axes.** They never share a field.
3. **Uncertainty is explicit.** "We don't know yet" is a valid, first-class state — it drives what to probe next.
4. **Beliefs decay and update, they are not overwritten blindly.** New evidence adjusts confidence; contradicting evidence lowers it and can flip a belief.
5. **Impressions are allowed but must be evidence-linked.** Human-like impressions ("seems to memorize rather than understand") are stored, but each cites the evidence that formed it.

## Top-level shape

```typescript
interface CandidateCognitiveModel {
  sessionId: string;
  userId: string;
  updatedAt: string;

  // Multi-dimensional belief axes (each a scored belief, see below)
  dimensions: Record<DimensionKey, DimensionBelief>;

  // Concept-level beliefs (what they know, per concept)
  concepts: ConceptBelief[];

  // Active/closed hypotheses about the candidate (see 05)
  hypotheses: HypothesisRef[];

  // Misconceptions detected (confidently-held wrong beliefs)
  misconceptions: Misconception[];

  // Resume claims and their verification state
  resumeClaims: ResumeClaim[];

  // Human-style evolving impressions (evidence-linked)
  impressions: Impression[];

  // Behavioral / emotional signals inferred from text & delivery only
  signals: BehavioralSignals;

  // What we still don't know — drives Director objectives (see 05)
  openUncertainties: Uncertainty[];

  // Growth tracking within & across sessions
  growth: GrowthTrace;
}
```

## The scored belief primitive

Every judgment in the model uses this shape so confidence and evidence are never lost:

```typescript
interface ScoredBelief {
  score: number;              // 0..10 the judgment itself
  confidence: number;         // 0..1 how sure WE are of the score
  verification: 'unverified' | 'partially-verified' | 'verified';
  evidenceIds: string[];      // links to Evidence objects (see 05)
  lastUpdatedTurn: number;
  trend: 'rising' | 'falling' | 'flat' | 'unknown';
}
```

`score` and `confidence` are independent: a candidate can have a *low* knowledge score we are *highly* confident about, or a *high* score we are *not* yet confident about (answered once, fluently, not yet probed).

## Dimensions

These are the multi-dimensional scores the product surfaces. Each is a `ScoredBelief`. They map onto — and enrich — the flat scores V1 already produces in `buildEvaluatorMessages`.

```typescript
type DimensionKey =
  | 'knowledge'          // factual correctness (V1 technicalScore/accuracyScore)
  | 'understanding'      // grasp of "why", not just "what"
  | 'reasoning'          // trade-offs, problem decomposition (V1 problemSolvingScore)
  | 'communication'      // clarity to a human (V1 communicationScore) — NEVER knowledge
  | 'terminology'        // correct use of domain vocabulary
  | 'depth'              // detail & edge cases (V1 depthScore)
  | 'confidence'         // how assured, without bluffing (V1 confidenceScore)
  | 'problemSolving'     // approach quality
  | 'architectureThinking' // system-level tradeoff thinking
  | 'productionThinking' // ops/failure-mode awareness (V1 productionThinking)
  | 'behavior'           // ownership, collaboration, STAR quality
  | 'learningAbility'    // how well they incorporate hints/corrections
  | 'interviewReadiness';// synthesized overall (V1 readinessScore)
```

Separation is enforced at the source: `knowledge`, `understanding`, `reasoning`, `terminology`, `depth`, `architectureThinking`, `productionThinking` are fed only by the Technical Evaluator + Misconception Detector. `communication` is fed only by the Communication Evaluator. `interviewReadiness` is a synthesis computed by the Director/Report Writer, never scored raw by an evaluator.

## Concept beliefs

Per-concept knowledge, richer than a single EMA score:

```typescript
interface ConceptBelief {
  conceptSlug: string;         // matches Concept.slug
  knowledge: ScoredBelief;     // do they know it
  understanding: ScoredBelief; // do they understand why
  status: 'unknown' | 'weak' | 'learning' | 'strong' | 'mastered' | 'misconception';
  timesProbed: number;
  neighborhoodInfluence?: number; // inferred from graph edges (see 06)
}
```

`neighborhoodInfluence` lets a failure on one concept lower confidence in prerequisite/related concepts without direct probing — flagged as inferred, not verified.

## Misconceptions

A misconception is distinct from a gap: a gap is "doesn't know," a misconception is "confidently believes something wrong." These are high-value interview signals.

```typescript
interface Misconception {
  id: string;
  conceptSlug: string;
  statement: string;          // what they wrongly believe
  correctStatement: string;
  confidenceOfCandidate: number; // how strongly THEY hold it (0..1)
  ourConfidence: number;         // how sure WE are it's a misconception (0..1)
  evidenceIds: string[];
  status: 'suspected' | 'confirmed' | 'corrected';
}
```

## Resume claims

Populates the currently-dead `resumeClaimsVerified` field with real structure. Emitted by the Resume Analyst at start, verified as the interview progresses.

```typescript
interface ResumeClaim {
  id: string;
  claim: string;              // "Built a Redis caching layer handling 10k rps"
  conceptSlugs: string[];
  importance: 'high' | 'medium' | 'low';
  verification: 'unverified' | 'probing' | 'verified' | 'contradicted';
  evidenceIds: string[];
}
```

## Impressions (human memory)

Soft, narrative beliefs an interviewer forms — allowed, but each must cite evidence so the Report Writer can justify them.

```typescript
interface Impression {
  id: string;
  text: string;               // "Tends to memorize patterns rather than reason from fundamentals"
  category: 'problem-solving' | 'communication-style' | 'attitude' | 'depth' | 'other';
  confidence: number;         // 0..1
  evidenceIds: string[];      // REQUIRED — no evidence, no impression
  firstSeenTurn: number;
  reinforcedCount: number;
}
```

## Behavioral / emotional signals

Inferred only from text and delivery metrics already available (`fillerWordCount`, `wordsPerMinute`, `speakingSeconds` on `Question`). Never from camera/audio emotion. Optional; absent when unknown.

```typescript
interface BehavioralSignals {
  composureUnderPressure?: ScoredBelief;
  handlesAmbiguity?: ScoredBelief;
  respondsToHints?: ScoredBelief; // key learningAbility input
  nervousnessHint?: 'low' | 'medium' | 'high' | 'unknown';
}
```

## Open uncertainties

The explicit "what we don't know" list. This is the Director's primary fuel: an interview is a search that reduces uncertainty.

```typescript
interface Uncertainty {
  id: string;
  about: string;              // "Is their claimed system-design experience real?"
  linkedHypothesisId?: string;
  conceptSlugs: string[];
  priority: number;           // 0..1, higher = more worth resolving now
  status: 'open' | 'reducing' | 'resolved';
}
```

## Growth trace

Tracks movement within a session and across sessions (feeds Progress screens and `ProgressSnapshot`).

```typescript
interface GrowthTrace {
  perDimension: Record<DimensionKey, { start: number; current: number }>;
  recentlyImprovedConcepts: string[];
  persistentlyWeakConcepts: string[];
  respondedToCoaching: boolean | null;
}
```

## Update lifecycle

```
turn N answer
  -> evaluators + misconception detector emit Evidence (see 05)
  -> Evidence Engine attaches evidence to beliefs
  -> for each affected belief:
       recompute score (weighted by evidence strength)
       recompute confidence (more consistent evidence => higher)
       update verification status (probed-and-consistent => verified)
       update trend
  -> update concepts (direct) + neighborhood (inferred, see 06)
  -> reconcile hypotheses & uncertainties (see 05)
  -> refresh impressions (reinforce or contradict)
  -> persist CCM
```

Update rules:
- **Confidence rises** when independent evidence agrees; **falls** when evidence conflicts.
- **A single fluent answer** raises `knowledge.score` but not `knowledge.confidence` until verified by a targeted probe.
- **Contradicting evidence** never silently overwrites — it lowers confidence, may flip `verification` back to `partially-verified`, and can spawn a new hypothesis.
- **Neighborhood influence** only adjusts confidence, never sets `verification` to `verified`.

## Backward compatibility

- `Session.memory` continues to be written (V1 fallback) — the CCM is stored alongside it (see [08](08-database-and-apis.md)).
- `UserConceptMastery.masteryScore/status` keep updating; `ConceptBelief` is the richer superset.
- If the CCM is missing or corrupt, the orchestrator reads `Session.memory` and V1 behavior resumes.

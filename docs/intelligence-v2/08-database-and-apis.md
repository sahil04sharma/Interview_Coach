# 08 — Database & API Changes

> All changes are **additive and backward compatible**. No existing model, column, route, or response field is removed or renamed. Existing rows keep working; V2 data is optional and nullable.

## Prisma: new models

Added alongside the current schema (`server/prisma/schema.prisma`). Names chosen to avoid collision with existing models.

```prisma
// The persisted Candidate Cognitive Model (one active row per session).
model CognitiveModel {
  id          String   @id @default(uuid())
  sessionId   String   @unique
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String
  dimensions  Json     // Record<DimensionKey, ScoredBelief>
  concepts    Json     // ConceptBelief[]
  impressions Json     // Impression[]
  signals     Json?    // BehavioralSignals
  growth      Json?    // GrowthTrace
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@index([userId])
}

model Hypothesis {
  id          String   @id @default(uuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  statement   String
  conceptSlugs String[] @default([])
  origin      String   // resume-analyst | evaluator | misconception-detector | director
  status      String   @default("open")   // open|supported|refuted|inconclusive
  confidence  Float    @default(0.5)
  priority    Float    @default(0.5)
  createdTurn Int      @default(0)
  lastTestedTurn Int?
  createdAt   DateTime @default(now())

  @@index([sessionId])
}

model Evidence {
  id            String   @id @default(uuid())
  sessionId     String
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  questionId    String?
  turn          Int      @default(0)
  source        String   // technical-evaluator | communication-evaluator | ...
  observation   String
  dimension     String?
  conceptSlugs  String[] @default([])
  polarity      String   @default("neutral") // supports|contradicts|neutral
  strength      Float    @default(0.5)
  confidence    Float    @default(0.5)
  alternatives  String[] @default([])
  hypothesisId  String?
  createdAt     DateTime @default(now())

  @@index([sessionId])
  @@index([questionId])
  @@index([hypothesisId])
}

model Misconception {
  id            String   @id @default(uuid())
  sessionId     String
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  conceptSlug   String
  statement     String
  correctStatement String @default("")
  candidateConfidence Float @default(0.5)
  ourConfidence Float    @default(0.5)
  status        String   @default("suspected") // suspected|confirmed|corrected
  createdAt     DateTime @default(now())

  @@index([sessionId])
}

// Resume claims tracked for verification (fills the dead resumeClaimsVerified concept).
model ResumeClaim {
  id           String   @id @default(uuid())
  sessionId    String
  session      Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  claim        String
  conceptSlugs String[] @default([])
  importance   String   @default("medium")
  verification String   @default("unverified") // unverified|probing|verified|contradicted
  createdAt    DateTime @default(now())

  @@index([sessionId])
}

model Uncertainty {
  id               String  @id @default(uuid())
  sessionId        String
  session          Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  about            String
  conceptSlugs     String[] @default([])
  linkedHypothesisId String?
  priority         Float   @default(0.5)
  status           String  @default("open") // open|reducing|resolved
  createdAt        DateTime @default(now())

  @@index([sessionId])
}

// Typed concept edges (see 06). Complements Concept.parentId tree.
model ConceptEdge {
  id       String @id @default(uuid())
  fromSlug String
  toSlug   String
  type     String // prerequisite | related | part-of | commonly-confused-with
  weight   Float  @default(0.5)

  @@unique([fromSlug, toSlug, type])
  @@index([fromSlug])
  @@index([toSlug])
}
```

### Relations added to existing models (additive back-relations only)

```prisma
model Session {
  // ...all existing fields unchanged...
  cognitiveModel CognitiveModel?
  hypotheses     Hypothesis[]
  evidence       Evidence[]
  misconceptions Misconception[]
  resumeClaims   ResumeClaim[]
  uncertainties  Uncertainty[]
}
```

No changes to `Session` scalar columns are required — the `memory` Json blob and all report columns stay. Optionally, a `directorObjective Json?` and `questionPlan Json?` can be added to `Question` to record the objective/plan behind each question (purely for auditability); these are nullable and ignored by V1.

## Migration strategy

- Single additive Prisma migration; all new tables, all new columns nullable/defaulted.
- No data backfill needed — sessions without a `CognitiveModel` fall back to `Session.memory`.
- `ConceptEdge` seeded separately (see [06](06-knowledge-graph-v2.md)); empty is valid.
- Reversible: dropping the new tables restores exact V1 behavior.

## API changes (all additive)

Existing endpoints keep their request bodies and all current response fields. V2 only adds optional fields.

### `POST /session/start`
- Request: unchanged.
- Behavior: additionally runs Resume Analyst, creates `CognitiveModel`, seeds `Hypothesis`/`ResumeClaim`/`Uncertainty`.
- Response: unchanged shape + optional `intelligence: { hypothesisCount, claimCount }`.

### `POST /session/:id/answer`
- Request: unchanged.
- Behavior: runs split evaluators (+ gated misconception detector), updates CCM + hypotheses/evidence, runs Director → Planner → Generator for the next question.
- Response: existing evaluation fields unchanged (populated from the mapping in [07](07-prompts-and-json-schemas.md)) + optional:
```jsonc
{
  // ...all existing fields (technicalScore, communicationScore, feedback, nextQuestion, ...)...
  "intelligence": {
    "objective": { "objectiveType": "verify-hypothesis", "rationale": "..." },
    "updatedHypotheses": [ { "id": "h_12", "status": "refuted" } ],
    "newMisconceptions": [ { "conceptSlug": "redis-eviction" } ]
  }
}
```

### `POST /session/:id/finish`
- Request: unchanged.
- Behavior: Report Writer produces explainable report; legacy verdict fields still populated.
- Response: existing verdict fields unchanged + optional `intelligence.report` (dimension narratives, resolved hypotheses, evidence-linked strengths/weaknesses per [07](07-prompts-and-json-schemas.md)).

### New read-only endpoints (optional, for the richer UI later)
- `GET /session/:id/cognitive-model` → current CCM projection.
- `GET /session/:id/hypotheses` → hypotheses + evidence chains.

These are new and additive; the current UI does not call them until the V2 UI phase.

## Backward-compatibility guarantees

1. Every existing `Question`/`Session` column is still written (via legacy field mapping in [07](07-prompts-and-json-schemas.md)).
2. Every existing response field is still present with the same type.
3. If any new table is empty or any agent fails, endpoints behave exactly like V1.

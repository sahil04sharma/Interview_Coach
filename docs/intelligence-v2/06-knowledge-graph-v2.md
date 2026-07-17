# 06 — Knowledge Graph V2

> Evolve the current parent/child `Concept` tree into a graph with typed `prerequisite` and `related` edges, enabling neighborhood influence: reasoning about concepts the candidate was never directly asked.

## Today

```124:139:server/prisma/schema.prisma
model Concept {
  ...
  parentId      String?
  parent        Concept?             @relation("ConceptTree", fields: [parentId], references: [id])
  children      Concept[]            @relation("ConceptTree")
```

Only hierarchy exists (Redis → Caching → TTL as parent/child). There is no way to encode that:
- indexing **requires** understanding B-trees (prerequisite), or
- eviction is **related to** cache invalidation (sibling influence across branches).

So a failure on one concept can't inform beliefs about connected concepts, and the Director can't sequence prerequisites.

## V2 additive graph

Keep the tree (`parentId` stays). Add a typed edge table so a concept can have many relationships beyond its single parent.

```typescript
type EdgeType = 'prerequisite' | 'related' | 'part-of' | 'commonly-confused-with';

interface ConceptEdge {
  id: string;
  fromSlug: string;
  toSlug: string;
  type: EdgeType;
  weight: number;    // 0..1 strength of the relationship
}
```

- `prerequisite(A -> B)`: understanding B requires A. (B-trees → DB indexing)
- `related(A -> B)`: adjacent knowledge; evidence on A weakly informs B. (eviction ↔ cache invalidation)
- `part-of(A -> B)`: A is a component of B (finer than tree parent where needed).
- `commonly-confused-with(A -> B)`: powers the Misconception Detector's priors (TTL vs eviction).

Edges are directional; `related` edges are typically stored both ways or treated symmetrically.

## Neighborhood influence

When direct evidence updates a `ConceptBelief` (see [03](03-candidate-cognitive-model.md)), influence propagates to neighbors — but only as *confidence adjustment*, never as verified fact.

```
onConceptUpdate(concept C, delta):
  for each edge (C -> N):
    influence = delta * edge.weight * DAMPING
    if edge.type == 'prerequisite' and C failed:
        lower N.knowledge.confidence      // shaky foundation => doubt dependents
    if edge.type == 'related':
        nudge N.knowledge.score slightly, mark verification='unverified'
    if edge.type == 'commonly-confused-with' and misconception on C:
        raise prior that N is also confused
  never set N.verification = 'verified' via influence
```

- `DAMPING` (e.g. 0.3) prevents runaway propagation; influence does not cascade more than one hop by default.
- Inferred adjustments are tagged (`neighborhoodInfluence` on `ConceptBelief`) so the Director knows they are guesses worth verifying, and the Report Writer never presents them as confirmed.

## How the Director uses the graph

1. **Prerequisite sequencing.** If a target concept has an unmet prerequisite with low confidence, the Director can probe the prerequisite first ("they can't discuss indexing if B-trees are shaky").
2. **Efficient coverage.** After confirming a strong hub concept, related neighbors get a confidence bump, so the Director can skip low-value repeats and spend budget on genuine unknowns (higher information gain per [05](05-hypothesis-and-evidence.md)).
3. **Misconception priors.** `commonly-confused-with` edges tell the Misconception Detector where to look.

## Seeding edges

- **Static seed:** a curated `concept-edges` seed file for common domains (caching, databases, React, system design), applied via the existing seeding path used for `Concept`.
- **LLM-assisted (optional, later):** when the curriculum generator (`buildRoleCurriculumMessages`) emits new concepts, an offline job can propose edges for human review. Not required for Phase 1.

## Migration path

| Current | V2 |
|---|---|
| `Concept.parentId` tree | unchanged; still the primary hierarchy |
| (no cross edges) | new `ConceptEdge` table ([08](08-database-and-apis.md)) |
| `UserConceptMastery.masteryScore` scalar | unchanged; `ConceptBelief` adds confidence + neighborhood influence on top |

If `ConceptEdge` is empty, V2 behaves exactly like the tree-only system — neighborhood influence simply finds no neighbors. This makes the graph a pure additive enhancement.

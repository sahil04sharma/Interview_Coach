# 07 — Prompt Contracts & JSON Schemas

> Per-agent prompt contracts and strict output schemas. These are the interfaces the implementation must honor. Prose here describes contracts; actual prompt strings live in code later (proposed home in [10](10-folder-structure-and-decisions.md)). Language handling reuses the existing `languageGuide()` from `server/src/prompts.js` — every agent that faces the candidate must respect it.

## Conventions

- All agents return **JSON only**, no prose wrapper (except the Report Writer's narrative fields, which are prose *inside* JSON).
- Every scored field uses the shared shape: `{ "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [...] }`.
- Unknowns are `null` or omitted, never guessed.
- Robust parsing: implementation must tolerate extra whitespace / code fences and validate against these schemas, falling back to V1 on parse failure.

## Shared sub-schemas

```jsonc
// ScoredField — used everywhere a judgment is made
{
  "score": 7,                 // 0..10
  "confidence": 0.6,          // 0..1 (how sure the agent is)
  "reason": "string",         // short evidence-style justification
  "conceptSlugs": ["redis-ttl"]
}

// EvidenceOut — emitted by evaluators/detector, stored per 05
{
  "observation": "string",
  "dimension": "knowledge",
  "conceptSlugs": ["..."],
  "polarity": "supports | contradicts | neutral",
  "strength": 0.7,
  "confidence": 0.8,
  "alternativeInterpretations": ["..."]
}
```

---

## 1. Resume Analyst

**Prompt contract:** "You extract verifiable claims and interview hypotheses from a resume. You do NOT score answers or write questions." Input: resume text, target role, JD, curriculum.

```jsonc
{
  "claims": [
    {
      "claim": "Built Redis caching layer handling 10k rps",
      "conceptSlugs": ["redis", "caching", "redis-eviction"],
      "importance": "high | medium | low"
    }
  ],
  "seedHypotheses": [
    {
      "statement": "Claims deep caching experience; verify operational depth",
      "conceptSlugs": ["redis-eviction"],
      "priority": 0.8
    }
  ],
  "seedUncertainties": [
    { "about": "Is claimed 10k rps scale real?", "conceptSlugs": ["scalability"], "priority": 0.7 }
  ]
}
```

## 2. Technical Evaluator

**Prompt contract:** "Judge ONLY correctness, understanding, reasoning, depth, terminology. You must NOT score clarity, fluency, structure, or delivery. Do not penalize Hindi/Hinglish/plain phrasing (per language guide). Do not choose the next question." Input: question, answer, linked concepts, difficulty, language guide.

```jsonc
{
  "knowledge": { "score": 6, "confidence": 0.7, "reason": "...", "conceptSlugs": ["..."] },
  "understanding": { "score": 5, "confidence": 0.6, "reason": "..." },
  "reasoning": { "score": 6, "confidence": 0.6, "reason": "..." },
  "depth": { "score": 4, "confidence": 0.7, "reason": "..." },
  "terminology": { "score": 7, "confidence": 0.8, "reason": "..." },
  "architectureThinking": { "score": 5, "confidence": 0.4, "reason": "..." },
  "productionThinking": { "score": 3, "confidence": 0.5, "reason": "..." },
  "conceptsCorrect": ["redis-ttl"],
  "conceptsPartial": ["caching"],
  "conceptsIncorrect": ["redis-eviction"],
  "knowledgeGaps": ["eviction policies", "memory pressure handling"],
  "evidence": [ /* EvidenceOut[], dimension in the technical set only */ ]
}
```

Mapping to legacy: `knowledge.score`→`technicalScore`/`accuracyScore`, `reasoning.score`→`problemSolvingScore`, `depth.score`→`depthScore`, `productionThinking.score`→`productionThinking`. This keeps `Question` columns populated for backward compatibility ([08](08-database-and-apis.md)).

## 3. Communication Evaluator

**Prompt contract:** "Judge ONLY clarity, structure, and delivery to a human listener. You must NOT judge factual correctness or technical depth — a wrong answer can still be well-communicated. Respect the language guide; never penalize accent or code-switching." Input: question, answer, delivery metrics, language guide.

```jsonc
{
  "communication": { "score": 7, "confidence": 0.8, "reason": "clear, sequenced explanation" },
  "structure": { "score": 6, "confidence": 0.7, "reason": "some rambling mid-answer" },
  "star": {
    "situation": 6, "task": 5, "action": 7, "result": 3   // or null when not story-based
  },
  "deliveryNotes": "Moderate filler; good pacing at ~130 wpm",
  "evidence": [ /* EvidenceOut[], dimension = 'communication' only */ ]
}
```

Mapping to legacy: `communication.score`→`communicationScore`, `structure.score`→`structureScore`, `star.*`→`starSituation/Task/Action/Result`.

## 4. Misconception Detector

**Prompt contract:** "Identify confidently-held WRONG beliefs, distinct from gaps. Only report a misconception when the candidate stated something incorrect as if true. Rate how strongly they seemed to hold it and how sure you are it's wrong." Runs only when gated (see [09](09-orchestration-pipeline.md)).

```jsonc
{
  "misconceptions": [
    {
      "conceptSlug": "redis-eviction",
      "statement": "Believes TTL expiry and eviction policy are the same mechanism",
      "correctStatement": "TTL expires keys by time; eviction removes keys under memory pressure via a policy (LRU/LFU/etc).",
      "confidenceOfCandidate": 0.7,
      "ourConfidence": 0.6,
      "conceptSlugs": ["redis-ttl", "redis-eviction"]
    }
  ]
}
```

## 5. Interview Director

**Prompt contract:** "You are the interview strategist. Given the candidate model, choose the SINGLE most valuable objective for the next question. Output strategy only — you must NOT write any question text. Maximize information gain: prefer verifying high-priority open hypotheses/uncertainties, probing misconceptions, and satisfying required company/mode coverage, while respecting follow-up budget and avoiding covered topics." Input: compact CCM projection + company weights + budgets.

```jsonc
{
  "objectiveType": "verify-hypothesis | reduce-uncertainty | probe-misconception | stretch-strength | cover-required | behavioral | re-probe-weak",
  "targetHypothesisId": "h_12",         // nullable
  "targetUncertaintyId": null,
  "targetConceptSlugs": ["redis-eviction"],
  "difficulty": "easy | medium | hard",
  "followUp": false,
  "expectedConfidenceGain": 0.4,
  "rationale": "Redis depth claimed but unverified; last answer fluent yet generic. Probe eviction."
}
```

## 6. Question Planner

**Prompt contract:** "Translate the objective into a concrete question plan. Do NOT write the final question; produce a spec." Input: objective, concept beliefs, curriculum, covered topics, company style.

```jsonc
{
  "intent": "WEAK_TOPIC_PROBE",          // reuses V1 intent vocabulary where possible
  "questionType": "database",             // from V1 questionType enum
  "topic": "Redis eviction under memory pressure",
  "targetConceptSlug": "redis-eviction",
  "expectedConcepts": ["LRU", "LFU", "maxmemory-policy"],
  "verificationGoal": "Confirm whether candidate understands eviction vs TTL",
  "difficulty": "hard",
  "starRequired": false
}
```

## 7. Question Generator

**Prompt contract:** "Render ONE natural interviewer question from this plan, in the interview language and Emma's warm-professional voice. Do NOT change the topic, difficulty, or intent. Do NOT add a second question. Output ONLY the question text (plus brief setup if needed)." Input: question plan, language guide, company framing, previous questions.

Output: plain string (not JSON), identical in shape to today's `buildInterviewerMessages` return so the voice/TTS layer is untouched.

## 8. Report Writer

**Prompt contract:** "Write an explainable interview debrief. Every conclusion must trace to evidence (hypothesis → probe → observation → conclusion). Do NOT assert claims without an evidence reference. Judge substance over language per the verdict language guide." Input: full CCM, hypotheses, misconceptions, evidence, transcript, growth.

```jsonc
{
  "hiringVerdict": "Strong Hire | Hire | Leaning Hire | Leaning No Hire | No Hire",
  "hireProbability": 62,
  "readiness": 6.5,
  "dimensionReport": [
    {
      "dimension": "knowledge",
      "score": 6, "confidence": 0.7,
      "narrative": "Solid on caching basics; probed Redis eviction on Q4 and found TTL/eviction confusion (see evidence e_31), lowering confidence in claimed depth.",
      "evidenceIds": ["e_12", "e_31"]
    }
  ],
  "strengths": [ { "text": "Clear communicator", "evidenceIds": ["e_08"] } ],
  "weaknesses": [ { "text": "Operational depth gaps in caching", "evidenceIds": ["e_31"] } ],
  "resolvedHypotheses": [ { "id": "h_12", "status": "refuted", "summary": "..." } ],
  "misconceptions": [ { "conceptSlug": "redis-eviction", "status": "confirmed" } ],
  "recommendedLearningPath": "2-4 sentences...",
  // legacy-compatible fields also emitted so existing report UI keeps working:
  "reasoning": "...", "repeatedMistakes": ["..."], "missedConcepts": ["..."]
}
```

## Validation & fallback policy

- Each schema is validated after parse. On failure: retry once with a "return valid JSON only" nudge, then fall back to the corresponding V1 builder.
- Legacy-compatible fields (listed above) are always emitted or derived so `Question`, `Session`, and report UI never see missing columns.

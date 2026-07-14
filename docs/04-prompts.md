# 04 — LLM Prompts

All prompts live in `server/src/prompts.js` as functions returning message arrays for the
OpenAI-compatible `chat/completions` endpoint.

## 1. Interviewer

Used in `/session/start` and after each answer in `/session/:id/answer`.

Inputs: `companyStyle.name`, `companyStyle.styleNotes`, `resumeText`, optional `jdText`,
`weakTopics`, `strongTopics`, `previousQuestions`, `mode`.

Rules:
- Ask ONE question at a time, referencing something specific from the resume or JD when possible.
- Bias toward weak topics, but do not ignore JD requirements.
- Match difficulty and follow-up style from the company style notes.
- Do not repeat previous questions/topics from this session.
- Output ONLY the question text.

## 2. Evaluator

Used in `/session/:id/answer`. Inputs: `companyStyle.name`, `questionText`, `userAnswer`.

Returns strict JSON:
```json
{
  "technicalScore": 0,
  "communicationScore": 0,
  "depthScore": 0,
  "structureScore": 0,
  "idealAnswer": "concise ideal answer, 3-5 sentences",
  "missingPoints": ["point 1", "point 2"],
  "topicTags": ["topic1", "topic2"],
  "feedback": "1-2 sentence direct feedback"
}
```
Tone: strict, not encouraging.

## 3. Hiring Verdict

Used in `/session/:id/finish`. Inputs: `companyStyle.name`, all questions with scores + feedback.

Returns strict JSON:
```json
{
  "hiringVerdict": "Strong Hire | Hire | Leaning Hire | Leaning No Hire | No Hire",
  "reasoning": "2-3 sentences citing specific weak points"
}
```

## 4. JD Extraction (helper)

Used in `/session/start` only when `jdText` is present. Extracts required skills and seniority into
a short JSON object that is injected as extra context into the first Interviewer call.

```json
{ "requiredSkills": ["..."], "seniority": "junior|mid|senior|staff|unknown" }
```

## Parsing

- Evaluator/Verdict/JD calls request JSON output. The adapter strips accidental ```` ```json ````
  fences and `JSON.parse`s. On failure it throws a 502-mapped error.
- Interviewer returns raw text (trimmed).

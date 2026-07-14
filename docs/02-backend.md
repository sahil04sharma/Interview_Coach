# 02 — Backend

Express (ES modules) + Prisma + Postgres.

## Folder Layout

```
server/
├── package.json
├── .env                     # created from root .env.example (gitignored)
├── prisma/
│   ├── schema.prisma
│   └── seed.js              # hardcoded user + company styles
└── src/
    ├── index.js             # express app + route mounting
    ├── db.js                # PrismaClient singleton
    ├── llm.js               # OpenAI-compatible adapter
    ├── prompts.js           # interviewer / evaluator / verdict / JD-extract builders
    └── routes/
        ├── user.js
        ├── companyStyles.js
        └── session.js
```

## Prisma Schema (from spec)

Models: `User`, `Session`, `Question`, `CompanyStyle` — exactly as defined in
[../ai-interview-coach-spec.md](../ai-interview-coach-spec.md).

- `User`: `resumeText`, `targetRole?`, `weakTopics[]`, `strongTopics[]`, sessions.
- `Session`: `companyStyle`, `jdText?`, `mode`, questions, `overallScore?`, `hiringVerdict?`.
- `Question`: `questionText`, `userAnswer`, `idealAnswer`, `missingPoints[]`, `topicTags[]`,
  four score floats, `feedback`.
- `CompanyStyle`: `name @unique`, `styleNotes`.

## Seed

- One `User` with `id = HARDCODED_USER_ID` (from env), empty resume/role, empty topic arrays.
- `CompanyStyle` rows: `google`, `meta`, `amazon`, `tcs`, `infosys`, `startup`, each with a 2–4
  sentence `styleNotes` describing difficulty, follow-up behavior, and tone.
- Idempotent via `upsert` so re-seeding is safe.

## Routes

Base URL: `http://localhost:4000`. All JSON.

| Method | Route | Behavior |
|--------|-------|----------|
| GET  | `/auth/me` | Current user (Bearer token) |
| POST | `/auth/signup` | Create account → `{ token, user }` |
| POST | `/auth/signin` | Sign in → `{ token, user }` |
| GET  | `/user/me` | Profile incl. weak/strong topics |
| PUT  | `/user/me` | Update `name`, `resumeText`, `targetRole` |
| GET  | `/company-styles` | List seeded styles for dropdown |
| POST | `/session/start` | Load user+style, optional JD extract, create Session, first question |
| POST | `/session/:id/answer` | Evaluate answer, save Question, generate next question |
| POST | `/session/:id/finish` | Aggregate scores, merge weak/strong topics, hiring verdict, report |
| GET  | `/session/:id` | Full session + questions (for report reload) |
| GET  | `/health` | Liveness check |

### `/session/start` body
```json
{ "userId": "...", "companyStyle": "google", "jdText": "optional", "mode": "technical" }
```
Returns `{ sessionId, question }`.

### `/session/:id/answer` body
```json
{ "questionText": "...", "userAnswer": "..." }
```
Returns `{ nextQuestion, lastEvaluation }`.

### `/session/:id/finish`
- `overallScore` = average across all four score fields of all questions.
- topicTags where `technicalScore < 6` → merged into `user.weakTopics` (deduped).
- topicTags where `technicalScore >= 8` → merged into `user.strongTopics` (deduped).
- `hiringVerdict` + reasoning via LLM.
- Returns the full session report.

## Error Handling

- Central error middleware returns `{ error: message }` with appropriate status.
- LLM JSON parse failures surface a 502 with a clear message rather than crashing.

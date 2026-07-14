# AI Interview Coach — MVP Build Spec

## Goal
Personal tool to run mock interviews, get real analysis/correctness feedback, target specific companies (product-based like Google/Meta or service-based like TCS), run interviews based on a pasted JD, and track weak topics over time so the AI trains me toward the areas I actually need.

This is a scoped MVP. No voice, no video, no multi-agent orchestration, no dashboards. Two prompts, one DB, four screens.

---

## Tech Stack

- **Frontend:** React + Vite, JavaScript, Tailwind CSS
- **Backend:** Node.js + Express, JS
- **Database:** PostgreSQL + Prisma ORM
- **AI:** Single LLM provider (Groq or OpenAI — use whichever key is available), no multi-model orchestration for v1
- **Auth:** Skip for v1. Single hardcoded user (me). Add auth later if this becomes multi-user.

---

## Database Schema (Prisma)

```prisma
model User {
  id            String    @id @default(uuid())
  name          String
  resumeText    String
  targetRole    String?
  weakTopics    String[]  @default([])
  strongTopics  String[]  @default([])
  sessions      Session[]
  createdAt     DateTime  @default(now())
}

model Session {
  id            String     @id @default(uuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])

  companyStyle  String     // e.g. "google", "tcs", "startup", "custom"
  jdText        String?
  mode          String     // "technical" | "behavioral" | "coding" | "system-design"

  questions     Question[]

  overallScore  Float?
  hiringVerdict String?    // "Strong Hire" | "Hire" | "Leaning Hire" | "Leaning No Hire" | "No Hire"
  createdAt     DateTime   @default(now())
}

model Question {
  id                  String   @id @default(uuid())
  sessionId           String
  session             Session  @relation(fields: [sessionId], references: [id])

  questionText        String
  userAnswer          String
  idealAnswer         String
  missingPoints        String[]
  topicTags           String[]

  technicalScore      Float
  communicationScore  Float
  depthScore          Float
  structureScore      Float
  feedback            String

  createdAt           DateTime @default(now())
}

model CompanyStyle {
  id          String  @id @default(uuid())
  name        String  @unique
  styleNotes  String
}
```

Seed `CompanyStyle` with at least: `google`, `meta`, `amazon`, `tcs`, `infosys`, `startup`. Each `styleNotes` should describe difficulty, follow-up behavior, and tone in 2-4 sentences. Adding a new company later = one DB insert, no code change.

---

## Core API Routes

### `POST /session/start`
Body: `{ userId, companyStyle, jdText?, mode }`
- Fetches user's resume, weakTopics, strongTopics
- Fetches companyStyle.styleNotes
- If jdText provided, run a quick extraction call to pull required skills/seniority from it
- Creates a Session row
- Calls Interviewer Prompt to generate first question
- Returns `{ sessionId, question }`

### `POST /session/:id/answer`
Body: `{ questionText, userAnswer }`
- Calls Evaluator Prompt with question + answer
- Saves Question row with scores, idealAnswer, missingPoints, topicTags, feedback
- Calls Interviewer Prompt again (with updated previousQuestions list) to generate next question
- Returns `{ nextQuestion, lastEvaluation }`

### `POST /session/:id/finish`
- Aggregates all Questions in the session
- Computes overallScore (average across score fields)
- Aggregates topicTags where technicalScore < 6 → merge into user.weakTopics (dedupe)
- Aggregates topicTags where technicalScore >= 8 → merge into user.strongTopics (dedupe)
- Generates hiringVerdict via a short LLM call summarizing the session
- Returns full session report

### `GET /user/:id`
- Returns user profile including weakTopics/strongTopics, for display before starting a new session

---

## Prompt 1: Interviewer

Used in `/session/start` and after each answer in `/session/:id/answer`.

```
You are conducting a technical interview in the style of {{companyStyle.name}}.

Interview style notes for this company: {{companyStyle.styleNotes}}

Candidate resume:
{{resumeText}}

{{#if jdText}}
Job description for this role:
{{jdText}}
{{/if}}

Candidate's known weak topics (probe these more): {{weakTopics}}
Candidate's known strong topics (don't over-focus here): {{strongTopics}}

Previous questions asked this session: {{previousQuestions}}

Rules:
- Ask ONE question at a time, referencing something specific from their resume or the JD when possible (e.g. "You mentioned Redis — where exactly did you use it?").
- Bias toward their weak topics, but don't ignore JD requirements.
- Match the difficulty and follow-up style described in the company style notes.
- Do not repeat previous questions or topics already covered this session.
- Output ONLY the question text, nothing else.
```

---

## Prompt 2: Evaluator

Used in `/session/:id/answer`.

```
You are an expert interview evaluator in the style of {{companyStyle.name}}.

Question asked: {{questionText}}
Candidate's answer: {{userAnswer}}

Evaluate the answer and respond ONLY in this JSON format, no markdown fences, no preamble:

{
  "technicalScore": 0-10,
  "communicationScore": 0-10,
  "depthScore": 0-10,
  "structureScore": 0-10,
  "idealAnswer": "concise ideal answer, 3-5 sentences",
  "missingPoints": ["point 1", "point 2"],
  "topicTags": ["topic1", "topic2"],
  "feedback": "1-2 sentence direct feedback on what to fix"
}

Be strict, not encouraging. This candidate wants to pass real {{companyStyle.name}} interviews, not feel good about a mock one.
```

## Prompt 3: Hiring Verdict (used in `/session/:id/finish`)

```
You are a hiring manager at {{companyStyle.name}} reviewing a full interview transcript.

Questions, answers, and scores from this session:
{{allQuestionsWithScoresAndFeedback}}

Give a final verdict in this JSON format:

{
  "hiringVerdict": "Strong Hire | Hire | Leaning Hire | Leaning No Hire | No Hire",
  "reasoning": "2-3 sentences explaining the verdict, citing specific weak points from the session"
}
```

---

## Frontend Screens

1. **Setup screen** — paste/upload resume (store as plain text for v1, no PDF parsing needed yet — just a textarea), set target role.
2. **New session screen** — pick company style from dropdown (seeded list), optionally paste JD, pick mode (technical/behavioral/coding/system-design). Shows current weakTopics/strongTopics for context.
3. **Interview screen** — shows current question, textarea for answer, submit button. On submit, shows the evaluation (scores + ideal answer + missing points + feedback) before loading the next question.
4. **Session report screen** — overall score, hiring verdict + reasoning, per-question breakdown, updated weak/strong topics.

Keep styling minimal for v1 — this is a personal tool, not a polished product. Function first.

---

## Explicitly Out of Scope for v1

- Voice interviews
- Video/camera analysis
- GitHub/LinkedIn/portfolio analyzers
- Multi-agent architecture (one interviewer prompt + one evaluator prompt is enough)
- Dashboards/analytics trends over time
- Multi-user auth
- Coding round with code execution (add later as a `mode` extension, not v1)

Build the four screens and three routes above first. Use it daily for real mock interviews. Only add scope once this loop is proven to help.

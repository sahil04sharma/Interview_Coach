# 01 — Architecture

## Overview

Two-part app: a Vite/React client talking over REST to an Express server, which uses Prisma to
persist to Postgres and calls a single OpenAI-compatible LLM endpoint for interviewing, evaluating,
and producing a final hiring verdict.

```mermaid
flowchart LR
  subgraph client [client: Vite + React]
    Setup[Setup]
    NewSession[New Session]
    Interview[Interview]
    Report[Report]
  end
  subgraph server [server: Express]
    API[REST routes]
    LLM[LLM adapter]
    Prisma[Prisma]
  end
  DB[(Postgres)]
  Setup --> API
  NewSession --> API
  Interview --> API
  Report --> API
  API --> LLM
  API --> Prisma
  Prisma --> DB
```

## Core Loop

```mermaid
sequenceDiagram
  participant U as User
  participant C as Client
  participant S as Server
  participant L as LLM
  participant D as DB

  U->>C: Fill resume (Setup)
  C->>S: PUT /user/:id
  S->>D: Update user
  U->>C: Pick company + mode (New Session)
  C->>S: POST /session/start
  S->>D: Load user + companyStyle
  opt JD provided
    S->>L: Extract skills/seniority
  end
  S->>D: Create Session
  S->>L: Interviewer prompt -> Q1
  S-->>C: { sessionId, question }
  loop Each answer
    U->>C: Type answer
    C->>S: POST /session/:id/answer
    S->>L: Evaluator prompt -> scores/feedback
    S->>D: Save Question
    S->>L: Interviewer prompt -> next Q
    S-->>C: { nextQuestion, lastEvaluation }
  end
  U->>C: Finish
  C->>S: POST /session/:id/finish
  S->>D: Aggregate scores, merge weak/strong topics
  S->>L: Hiring verdict prompt
  S-->>C: Full report
```

## Design Decisions

- **OpenAI-compatible adapter.** One `fetch` wrapper hitting `${LLM_BASE_URL}/chat/completions`.
  Swap OpenAI/Groq by changing `LLM_BASE_URL` + `LLM_MODEL` + `LLM_API_KEY`. No code fork.
- **Single hardcoded user.** Seeded with a fixed UUID from `HARDCODED_USER_ID`. Client reads the
  same id from `VITE_USER_ID`. No auth layer.
- **User-driven session length.** The interview continues while the user answers; there is no fixed
  question count. The user clicks "Finish" to end and generate the report.
- **Company styles are data, not code.** Adding a new company = one DB insert (see seed).
- **JSON-mode LLM calls.** Evaluator and Verdict prompts request strict JSON; the adapter parses
  and tolerates accidental markdown fences.

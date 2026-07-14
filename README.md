# AI Interview Coach (MVP)

A personal tool to run mock interviews, get strict analysis/correctness feedback, target specific
companies (product-based like Google/Meta or service-based like TCS/Infosys), run interviews based on a
pasted job description, and track weak topics over time so the AI trains you toward the areas you
actually need work on.

This is a scoped MVP: no voice, no video, no multi-agent orchestration, no dashboards.
Three LLM prompts, one DB, four screens.

## Tech Stack

- **Frontend:** React + Vite, JavaScript, Tailwind CSS
- **Backend:** Node.js + Express (JavaScript, ES modules)
- **Database:** PostgreSQL + Prisma ORM
- **AI:** Single OpenAI-compatible LLM provider (OpenAI or Groq) — selected via env vars
- **Auth:** None for v1. Single hardcoded user.

## Repo Layout

```
.
├── README.md                     # this file
├── docs/                         # design + task docs (read these first)
│   ├── 01-architecture.md
│   ├── 02-backend.md
│   ├── 03-frontend.md
│   ├── 04-prompts.md
│   ├── 05-setup-and-run.md
│   └── 06-roadmap.md
├── docker-compose.yml            # Postgres only
├── .env.example                  # root env template
├── server/                       # Express + Prisma API
└── client/                       # Vite + React UI
```

## Quick Start

See [docs/05-setup-and-run.md](docs/05-setup-and-run.md) for full instructions.

```bash
# 1. Start Postgres (Docker) OR point DATABASE_URL at a local Postgres
docker compose up -d

# 2. Backend
cd server
npm install
cp ../.env.example .env      # then fill in LLM_API_KEY
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                  # http://localhost:4000

# 3. Frontend
cd ../client
npm install
npm run dev                  # http://localhost:5173
```

## Documentation Index

| Doc | Contents |
|-----|----------|
| [docs/01-architecture.md](docs/01-architecture.md) | System diagram, data flow, request lifecycle |
| [docs/02-backend.md](docs/02-backend.md) | Prisma schema, routes, seed, folder layout |
| [docs/03-frontend.md](docs/03-frontend.md) | Screens, routing, API client, state |
| [docs/04-prompts.md](docs/04-prompts.md) | Interviewer / Evaluator / Verdict / JD-extract prompts |
| [docs/05-setup-and-run.md](docs/05-setup-and-run.md) | Env vars, DB, local run order, troubleshooting |
| [docs/06-roadmap.md](docs/06-roadmap.md) | Out-of-scope + future work |

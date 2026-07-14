# 05 — Setup & Run

## Prerequisites

- Node.js 18+ (tested on v22)
- PostgreSQL 14+ — either via Docker, or a local/hosted Postgres instance
- An API key for an OpenAI-compatible provider (OpenAI or Groq)

## Environment Variables

Copy `.env.example` to `server/.env` and fill in values.

| Var | Example | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/interview_coach?schema=public` | Prisma connection string |
| `LLM_API_KEY` | `sk-...` or `gsk_...` | Provider API key |
| `LLM_BASE_URL` | `https://api.openai.com/v1` or `https://api.groq.com/openai/v1` | OpenAI-compatible base |
| `LLM_MODEL` | `gpt-4o-mini` or `llama-3.3-70b-versatile` | Chat model |
| `JWT_SECRET` | long random string | Signs auth tokens |
| `PORT` | `4000` | Express port |

Client env (`client/.env`):

| Var | Example | Notes |
|-----|---------|-------|
| `VITE_API_BASE` | `/api` | Proxied to Express in dev |

Auth: sign up / sign in at `/signup` and `/signin`. JWT is stored in `localStorage` as `aic_token`.

## Database

### Option A — Docker
```bash
docker compose up -d
```

### Option B — Local Postgres (if Docker is unavailable)
This machine already has PostgreSQL 18 running as a Windows service. Put your real password in
`server/.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/interview_coach?schema=public"
```

Then create the database (once):
```bash
psql -U postgres -h localhost -c "CREATE DATABASE interview_coach;"
```

Or use a free hosted Postgres (Neon/Supabase) and paste its connection string into `DATABASE_URL`.

## Run Order

```bash
# 1. Database up (Option A or B)

# 2. Backend
cd server
npm install
cp ../.env.example .env        # then edit .env
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                     # http://localhost:4000

# 3. Frontend
cd ../client
npm install
npm run dev                     # http://localhost:5173
```

## Verifying

- `GET http://localhost:4000/health` returns `{ ok: true }`.
- `GET http://localhost:4000/company-styles` lists 6 seeded styles.
- Open http://localhost:5173, paste a resume on Setup, start a session, answer, finish.

## Troubleshooting

- **`docker` not recognized** → use Option B (local/hosted Postgres).
- **Prisma can't connect** → check `DATABASE_URL` host/port/credentials.
- **LLM 401** → check `LLM_API_KEY` matches the `LLM_BASE_URL` provider.
- **LLM JSON parse error** → try a more capable `LLM_MODEL`.

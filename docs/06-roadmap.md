# 06 — Roadmap & Out of Scope

## Explicitly Out of Scope for v1

- Voice interviews
- Video/camera analysis
- GitHub/LinkedIn/portfolio analyzers
- Multi-agent architecture (one interviewer + one evaluator prompt is enough)
- Dashboards / analytics trends over time
- Multi-user auth
- Coding round with code execution (mode is selectable; questions stay text-based)

## Future Work (post-MVP)

1. **Auth + multi-user** — replace hardcoded user with real accounts.
2. **PDF resume parsing** — upload PDF instead of pasting plain text.
3. **Coding mode with execution** — sandboxed runner for code answers.
4. **Trends dashboard** — weak/strong topic progress over time.
5. **Voice mode** — speech-to-text answers, TTS questions.
6. **Prompt tuning per company** — richer, versioned style notes.
7. **Export** — download session report as PDF/Markdown.

## Build Order (tracked in the plan todos)

1. Scaffold `client/` + `server/`, docker-compose, env examples.
2. Prisma schema, migrate, seed user + company styles.
3. LLM adapter + prompts.
4. Express routes.
5. React screens wired to the API.
6. End-to-end smoke test with a real API key.

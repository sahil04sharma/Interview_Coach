# 03 — Frontend

Vite + React + Tailwind. Minimal, function-first styling.

## Folder Layout

```
client/
├── package.json
├── index.html
├── vite.config.js           # dev proxy /api -> http://localhost:4000
├── tailwind.config.js
├── postcss.config.js
├── .env                     # VITE_USER_ID, VITE_API_BASE (optional)
└── src/
    ├── main.jsx             # router bootstrap
    ├── index.css            # tailwind directives
    ├── api.js               # fetch wrapper around the backend
    ├── config.js            # user id + api base from env
    └── screens/
        ├── Setup.jsx
        ├── NewSession.jsx
        ├── Interview.jsx
        └── Report.jsx
```

## Routes (React Router)

| Path | Screen | Purpose |
|------|--------|---------|
| `/signup` | SignUp | Create account |
| `/signin` | SignIn | Sign in |
| `/` | Setup | Paste resume, set target role, save |
| `/session/new` | NewSession | Pick company + mode, optional JD, show weak/strong topics, start |
| `/session/:id` | Interview | Show question, answer, view evaluation, next / finish |
| `/session/:id/report` | Report | Overall score, verdict, per-question breakdown, updated topics |

Protected routes require a JWT in `localStorage` (`aic_token`). Unauthenticated users are redirected to `/signin`.

## API Client (`src/api.js`)

Thin wrapper: `getUser`, `updateUser`, `getCompanyStyles`, `startSession`, `answer`,
`finishSession`, `getSession`. Uses `VITE_API_BASE` (default `/api`) with the Vite proxy forwarding
to the Express server.

## State

- No global state library. Each screen fetches what it needs.
- Interview screen holds: current question text, answer draft, last evaluation, loading flags.
- User id comes from `VITE_USER_ID` (matches the seeded hardcoded user).

## UX Notes

- On answer submit: show the evaluation panel (scores + ideal answer + missing points + feedback)
  first, then a "Next question" action loads the following question.
- "Finish session" is always available on the Interview screen and routes to the Report.
- Loading and error states are simple inline text; this is a personal tool.

# Vopa Mail

Vopa Mail is a static web frontend for Valley of Peace SDA Academy. It is built with Vite, React, and TypeScript and uses Supabase for accounts, mail, assignments, announcements, file storage, and moderation.

## Development

```bash
npm install
npm run dev
```

Production checks and build:

```bash
npm run typecheck
npm run lint
npm run build
```

Tests:

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright browser smoke tests
```

The Playwright suite uses the installed Chrome channel. Install it first with `npx playwright install chrome` if it is not already available.

Navigation is URL-driven: folders, open messages, assignments, announcements, students, and the teacher dashboard section all have shareable links. Deployments need an SPA fallback to `index.html`, which is configured for Vercel and Netlify.

The Vite build output is written to `dist/`.

## Configuration

Supabase settings live in `public/supabase-config.js` and are loaded before the app starts. Leave placeholder values in place to use local demo mode, or append `?demo=1` to the URL. Demo data is stored in `localStorage` on the current device.

## Supabase setup

Run the SQL files in `supabase/`, plus the Edge Function in `supabase/functions/set-user-password`, before connecting live classes.

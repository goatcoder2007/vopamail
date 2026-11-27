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

The Playwright suite runs against the production preview and uses the installed Chrome channel. Run `npm run build` first, and install Chrome with `npx playwright install chrome` if it is not already available.

Navigation is URL-driven: folders, open messages, assignments, announcements, students, and the teacher dashboard section all have shareable links. Deployments need an SPA fallback to `index.html`, which is configured for Vercel and Netlify.

The Vite build output is written to `dist/`.

## Configuration

Supabase settings live in `public/supabase-config.js` and are loaded before the app starts. The Supabase client library is bundled with the app, so no CDN script tag is required. Leave placeholder values in place to use local demo mode, or append `?demo=1` to the URL. Demo data is stored in `localStorage` on the current device.

## Supabase setup

Run the SQL files in `supabase/` in this order before connecting live classes: `schema.sql`, `assignments-announcements.sql`, `class-settings.sql`, `file-sharing.sql`, `moderation.sql`, `viewed-by.sql`, then `storage-policies.sql`. Deploy the Edge Function in `supabase/functions/set-user-password` and set its Supabase secrets.

Teacher access is granted per section in `public.teacher_sections`. The first teacher account is created from the sign-in screen; after that, each section code opened or switched to in the app is granted to that teacher account. If you need to grant an existing teacher access to more sections outside the app, insert rows into `public.teacher_sections` with their `teacher_id` and the section's `class_code`.

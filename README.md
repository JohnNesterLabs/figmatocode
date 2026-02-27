# Figma to Code Buddy

React + Vite app for importing a Figma file URL, generating multi-framework component files, previewing output, and pushing generated files to GitHub through a Supabase Edge Function.

## Stack

- Vite
- React + TypeScript
- Tailwind + shadcn/ui
- Supabase Functions
- Vitest

## Local Setup

```sh
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

Set these in `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Without these values, the "Push to GitHub" dialog will be disabled by runtime checks.

For GitHub OAuth (Connect GitHub button), set Edge Function secrets:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

And configure your GitHub OAuth App callback URL to:

- `http://localhost:8080/auth/github/callback` (local)
- `https://<your-domain>/auth/github/callback` (production)

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run lint` - eslint
- `npm test` - run tests once
- `npm run test:watch` - run tests in watch mode

## Notes

- Figma and GitHub tokens are stored in `sessionStorage` (per browser session).
- Current conversion output is scaffolded code generation; the app now validates/fetches Figma node data (name + variants) before generating files.

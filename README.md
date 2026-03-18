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

## Option A: Merge from figma-to-code-starter template

To pull in config, Supabase layout, and docs from [nester-dev-bot/figma-to-code-starter](https://github.com/nester-dev-bot/figma-to-code-starter) without replacing your app code:

1. **Clone the template** (you need access to the repo):
   ```sh
   git clone https://github.com/nester-dev-bot/figma-to-code-starter.git .template-ref
   ```

2. **Run the merge script:**
   ```sh
   node scripts/merge-from-template.js
   ```
   Or with a custom path: `TEMPLATE_REF=../figma-to-code-starter node scripts/merge-from-template.js`

3. **Install and run:**
   ```sh
   npm install
   npm run dev
   ```

The script copies `BACKEND.md`, `components.json`, `eslint.config.js`, `index.html`, merges `package.json` (adds template deps) and `.env.example`, and adds any missing Supabase files (it does not overwrite `supabase/functions/`). Your `src/` is left unchanged.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run lint` - eslint
- `npm test` - run tests once
- `npm run test:watch` - run tests in watch mode
- `node scripts/merge-from-template.js [path]` - merge from figma-to-code-starter template (Option A)

## Notes

- Figma and GitHub tokens are stored in `sessionStorage` (per browser session).
- Current conversion output is scaffolded code generation; the app now validates/fetches Figma node data (name + variants) before generating files.
- **Live preview** uses WebContainers (in-browser Node.js). For the live Vite preview, use Chrome or Edge. Other browsers fall back to static HTML preview.

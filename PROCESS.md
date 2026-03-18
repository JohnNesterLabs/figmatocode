# Figma to Code Buddy — End-to-End Process

This document describes how the app works from adding a Figma token to generating and previewing full UI, step by step.

---

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Adding Tokens (Settings)](#step-1-adding-tokens-settings)
3. [Step 2: Pasting Figma URL & Selecting Frameworks](#step-2-pasting-figma-url--selecting-frameworks)
4. [Step 3: Conversion Flow (Figma → Code)](#step-3-conversion-flow-figma--code)
5. [Step 4: Code Display & Editing](#step-4-code-display--editing)
6. [Step 5: Live Preview (WebContainer)](#step-5-live-preview-webcontainer)
7. [Step 6: Push to GitHub (Optional)](#step-6-push-to-github-optional)
8. [Architecture Summary](#architecture-summary)

---

## Overview

**Stack:** React + Vite + TypeScript, Tailwind + shadcn/ui, Supabase Edge Functions, WebContainers (in-browser Node.js for live preview).

**High-level flow:**

1. User adds **Figma Access Token** (and optionally **DeepSeek API Key**, **GitHub Token**) in Settings.
2. User pastes a **Figma design URL** and selects target **frameworks** (React, Vue, Svelte, Angular, Solid).
3. App fetches design data from Figma API, optionally uses **DeepSeek** to generate React+Tailwind code, or falls back to **mock multi-framework** code.
4. Generated **code** is shown in the Code panel (Monaco editor) with a file tree.
5. **Preview** is shown: live Vite app in WebContainer (Chrome/Edge) or static HTML fallback.
6. User can **push** generated files to a GitHub repo (existing or new) via Supabase Edge Function.

---

## Step 1: Adding Tokens (Settings)

**Where:** `SettingsSidebar` (`src/components/SettingsSidebar.tsx`)

**Storage:** `src/lib/tokenStorage.ts`

- All tokens are stored in **`sessionStorage`** (per browser tab/session). Keys:
  - `figma_token` — required for Figma API
  - `deepseek_token` — optional; when set, AI-generated React+Tailwind code is used instead of mock code
  - `github_token` — optional; used for "Push to GitHub"

**Flow:**

1. User clicks the **Settings** (gear) icon in the Import panel header → `SettingsSidebar` opens.
2. User enters:
   - **Figma Access Token** (e.g. `figd_...`) → "Save Token" → `setFigmaToken(token)`.
   - **DeepSeek API Key** (e.g. `sk-...`) → "Save DeepSeek Key" → `setDeepSeekToken(token)`.
   - **GitHub Access Token** (e.g. `ghp_...`) → "Save GitHub Token" → `setGitHubToken(token)`.
3. Each save reads from local state, writes to `sessionStorage` via `tokenStorage`, and shows a short "Saved" feedback.

**Important:** Without a Figma token, conversion will show: *"Please add your Figma Access Token in Settings first."*

---

## Step 2: Pasting Figma URL & Selecting Frameworks

**Where:** `ImportPanel` (`src/components/ImportPanel.tsx`)

**URL validation:** `src/lib/figma.ts` — `parseFigmaUrl(input)`

- Accepts `figma.com` or `*.figma.com` with path `/file/:fileKey` or `/design/:fileKey`.
- Optional query: `node-id=...` (hyphens in node-id are converted to colons for the Figma API later).
- If invalid, the "Send" button stays disabled.

**Frameworks:** `FrameworkChips` (`src/components/FrameworkChips.tsx`)

- User can select one or more of: **React**, **Vue**, **Svelte**, **Angular**, **Solid**.
- Selection is passed to the conversion handler; **mock code** is generated for each selected framework. When **DeepSeek** is used, only **React** output is produced (single `.tsx` + optional `.css`).

**Submit:** User clicks the send button (or presses Enter) → `handleSubmit()` → `onConvert(url.trim(), frameworks)`.

---
 
## Step 3: Conversion Flow (Figma → Code)

**Where:** `Index.tsx` — `runConversion(url, frameworks)`.

### 3.1 Pre-checks

- `getFigmaToken()`: if empty → set error *"Please add your Figma Access Token in Settings first."* and return.
- Clear previous state: `setError(null)`, `setIsConverting(true)`, `setComponentName(null)`, `setFiles([])`, `setPreviewHtml(null)`.

### 3.2 Progress UI (mock steps)

- `MOCK_STEPS` are shown in order: Fetching from Figma API → Parsing variants & layers → Exporting assets → AI-driven component generation → Optimizing code & accessibility → Injecting CSS & tokens.
- Each step is animated (pending → active → done) with short delays; then steps are cleared. This is **visual only**; real work happens after/during.

### 3.3 Figma API — Fetch design data

- **`fetchFigmaNodeData(url, token)`** (`src/lib/figma.ts`):
  - Parses URL → `fileKey`, `nodeId`.
  - If `nodeId`: `GET https://api.figma.com/v1/files/:fileKey/nodes?ids=:nodeId` (node-id normalized to colons).
  - Else: `GET https://api.figma.com/v1/files/:fileKey?depth=2`.
  - Header: `X-Figma-Token: <token>`.
  - Returns the **node document** (raw JSON tree).

- **`fetchFigmaNodeSummary(url, token)`**:
  - Uses `fetchFigmaNodeData` to get the root node.
  - Picks a "preferred" node: first of type `COMPONENT_SET`, `COMPONENT`, `FRAME`, or `INSTANCE` (else root if it has a name).
  - Derives **component name** via `toComponentName(node.name)` (PascalCase, safe chars).
  - **Variant labels**: if node is `COMPONENT_SET`, from children names; else `["Default"]`.
  - Returns `{ fileKey, nodeId, componentName, variantLabels }`.

### 3.4 Code generation (two paths)

**Path A — DeepSeek token present**

- **`generateComponentWithDeepSeek(name, rawFigmaData)`** (`src/lib/deepseek.ts`):
  - Reads `getDeepSeekToken()`; if missing, throws.
  - Sends to DeepSeek Chat API (`https://api.deepseek.com/v1/chat/completions`):
    - System prompt: React 18 + TypeScript + Tailwind, no markdown fences, correct `type`/`interface`.
    - User prompt: generate component from Figma JSON, variants if applicable, premium/modern look.
  - Strips ```tsx/``` from response and returns the raw component code.
- **Generated files:** one `${name}.tsx` (React+Tailwind) and one `${name}.css` (placeholder or minimal).

**Path B — No DeepSeek token**

- **`generateMockCode(name, frameworks, variants)`** (`Index.tsx`):
  - Builds scaffold files for each selected framework (e.g. `.lite.tsx`, `.jsx`, `.vue`, `.svelte`, `.component.ts`, `.tsx` for Solid) plus a shared `.css`.
  - Content is template-based (e.g. primary/secondary button with variant labels from Figma).

### 3.5 Post-generation

- `setFiles(generatedFiles)`, `setPreviewHtml(generatePreviewHtml(name, variants))`, `setComponentName(name)`.
- **Static preview HTML:** `generatePreviewHtml` builds a small HTML document with variant cards and the same button styles, used when WebContainer is not used or not ready.

### 3.6 Live preview (React + WebContainer only)

- If **WebContainer is supported** and **React** is in the selected frameworks:
  - **`extractReactPreviewFiles(files, name)`** (`src/lib/previewTemplate.ts`): picks the React component file (e.g. `.tsx`/`.jsx`) and its CSS.
  - **`getProjectFiles(name, componentCode, componentCss)`**: builds full Vite project file list (package.json, vite.config, index.html, Tailwind/PostCSS, src/main.tsx, src/App.tsx, src/index.css, `src/components/${name}.tsx`, `src/components/${name}.css`).
  - **`buildPreviewProject(name, componentCode, componentCss)`**: turns that list into a **FileSystemTree** for `@webcontainer/api`.
  - **`bootAndMount(tree)`** is called; when the dev server is ready, the iframe in the Preview panel shows the live URL.

- If WebContainer is not supported (e.g. non-Chromium): only static HTML preview is shown (from `previewHtml`).

- Finally: `setIsConverting(false)`.

---

## Step 4: Code Display & Editing

**Where:** `CodePanel` (`src/components/CodePanel.tsx`)

- **File tree:** Built from `files` (flat list of `{ name, language, content }`). Paths can be simple (`ComponentName.tsx`) or project paths (`src/components/ComponentName.tsx`). Folders are derived from path segments; expand/collapse state is kept.
- **Tabs:** Open files as tabs; active file is edited in Monaco.
- **Monaco:** Syntax highlighting by `language`, theme `vs-dark`. React types are injected for TypeScript.
- **Copy / Download:** Copy active file to clipboard; download active file as a file.
- **Push to GitHub:** If `files.length > 0`, a button opens `PushToGitHubDialog`.

**Live sync (when WebContainer is used):**

- `onEditorChange` is passed from `Index`. When the user edits in Monaco, after a 400ms debounce the handler runs:
  - **`getPreviewPathToFileName(files, componentName)`** maps WebContainer paths to CodePanel file names.
  - For each path that has a corresponding file, current content (from editor or `files`) is collected and passed to **`writeFiles(toWrite)`** (from `useWebContainer`), which writes into the WebContainer filesystem so the live preview updates.

---

## Step 5: Live Preview (WebContainer)

**Where:** `useWebContainer` (`src/hooks/useWebContainer.ts`), `PreviewPanel` (`src/components/PreviewPanel.tsx`), `previewTemplate.ts`.

**Support check:** `SharedArrayBuffer` and `serviceWorker` must exist (typically Chrome/Edge). Otherwise `isSupported === false` and only static HTML preview is used.

**Flow when `bootAndMount(tree)` is called:**

1. **Boot:** First time: `WebContainer.boot()`; store instance in a ref; listen for `error` → set status `error`.
2. **Mount:** `instance.mount(tree)` with the Vite project tree.
3. **Install:** `instance.spawn("npm", ["install"])`; wait for exit code 0 or throw.
4. **Start dev server:** `instance.spawn("npm", ["run", "dev"])`; listen for `server-ready` (port, URL). Store URL in state.
5. **Preview:** `PreviewPanel` receives `previewUrl` and renders an iframe with `src={previewUrl}`. Status goes through: idle → booting → mounting → installing → starting → ready (or error).

**Project layout (from `previewTemplate.ts`):**

- Root: `package.json`, `vite.config.ts`, `index.html`, `tailwind.config.js`, `postcss.config.js`.
- `src/main.tsx` (React root), `src/App.tsx` (imports component and renders it), `src/index.css` (Tailwind + base styles).
- `src/components/${componentName}.tsx` and `src/components/${componentName}.css` (generated component).

When the user edits in the Code panel, `writeFiles` updates files in the WebContainer so the running Vite dev server hot-reloads and the iframe shows the updated UI.

---

## Step 6: Push to GitHub (Optional)

**Where:** `PushToGitHubDialog` (`src/components/PushToGitHubDialog.tsx`), Supabase `github-push` Edge Function (`supabase/functions/github-push/index.ts`), `repoPath.ts`.

**Token:** Uses `getGitHubToken()` from `tokenStorage`. User can also connect via **GitHub OAuth** (callback at `/auth/github/callback` → `GitHubAuthCallback` posts message to opener with `code`/`state`; dialog exchanges code for token via Edge Function and saves it).

**Flow:**

1. User clicks "Push to GitHub" in Code panel → dialog opens with `files` and `componentName`.
2. **Repo source:** "Existing repo" or "New repo". For existing: Supabase function `github-push?action=repos` (with `x-github-token`) lists user repos; user picks one. For new: user enters name, optional description, public/private; function creates repo via GitHub API.
3. **Target path:** Directory in repo (e.g. `src/components`) and commit message. Path is validated with `normalizeRepoDirectory` / `buildRepoPath` (`src/lib/repoPath.ts`) to avoid `..`, absolute paths, and invalid segments.
4. **Push:** Dialog calls Supabase `github-push` with body: `githubToken`, `owner`, `repo`, `branch`, `commitMessage`, `files: [{ path, content }]`. Edge Function creates a blob per file, gets or creates the tree, creates a commit, and updates the branch (or creates repo first if "New repo").
5. On success, user sees commit URL and can open it.

**Environment:** Supabase URL and publishable key must be set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). For OAuth: Edge Function secrets `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` and callback URL configured on GitHub.

---

## Architecture Summary

| Layer | Responsibility |
|-------|----------------|
| **tokenStorage** | sessionStorage get/set for Figma, DeepSeek, GitHub tokens. |
| **figma.ts** | Parse Figma URL; fetch node/file from Figma API; derive component name and variant labels. |
| **deepseek.ts** | Call DeepSeek API to generate React+Tailwind component from Figma JSON. |
| **previewTemplate.ts** | Build Vite project file set and FileSystemTree; extract React/CSS from generated files; map WC paths to CodePanel names. |
| **useWebContainer** | Boot/mount WebContainer, npm install, run dev server, expose preview URL and writeFiles. |
| **Index.tsx** | Orchestrates conversion (token check → progress UI → Figma fetch → code gen → set files/preview → boot WebContainer if React). |
| **ImportPanel** | URL input, framework chips, convert button, error and progress display. |
| **CodePanel** | File tree, Monaco editor, copy/download, push to GitHub trigger, optional live sync to WebContainer. |
| **PreviewPanel** | iframe for live URL or static HTML; loading/error states. |
| **SettingsSidebar** | Input and save for Figma, DeepSeek, GitHub tokens. |
| **PushToGitHubDialog** | Repo list/create, path and commit message, call Edge Function to push files. |
| **github-push (Edge)** | GitHub API: list repos, create repo, get user; OAuth exchange; create blobs/tree/commit and push. |

**End-to-end:** Add Figma token (and optionally DeepSeek + GitHub) → paste Figma URL → select frameworks → Convert → Figma API fetches design → DeepSeek or mock generates code → Code panel shows files and Explorer → Preview shows live Vite (or static HTML) → optional push to GitHub via Supabase.

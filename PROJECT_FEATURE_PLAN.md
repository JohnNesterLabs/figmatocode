# Project Feature Plan (Lovable-Style)

This document outlines how to add a **project** feature so users can create, save, and switch between multiple projects, similar to Lovable's workspace/project model.

---

## Current State

- **Project state** lives only in React state inside `Index.tsx`:
  - `files` (CodeFile[])
  - `componentName`
  - `previewHtml`
- No persistence: refreshing or closing the tab loses everything
- **WebContainer** runs one preview at a time (singleton)
- **Supabase** is used for GitHub push (Edge Functions), not for project storage
- **Auth**: No Supabase auth; tokens (Figma, DeepSeek, GitHub) in `sessionStorage`

---

## Target Behavior (Lovable-Style)

1. **Create project** – New blank project or start from a new Figma conversion
2. **Save project** – Auto-save on changes + explicit "Save" action
3. **Switch project** – Dropdown/list to select another project; state loads and preview rebuilds
4. **Delete project** – Remove a project from the list

---

## 1. Project Data Model

```ts
// src/types/project.ts
export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  figmaUrl?: string;
  frameworks?: string[];
  // Core payload
  files: CodeFile[];
  componentName: string | null;
  previewHtml: string | null;
}
```

**Fields**:

- `id` – UUID or nanoid
- `name` – Display name (e.g. component name or user-defined)
- `files`, `componentName`, `previewHtml` – Same as current `Index` state
- `figmaUrl`, `frameworks` – Optional; useful for "Re-import from Figma" later

---

## 2. Storage Options

### Option A: localStorage (recommended first)

- Works offline, no backend changes
- Key: `figma-to-code-projects` → `Project[]`
- Limit: ~5MB per origin; projects with many/large files may hit limits
- No sync across devices

**Pros**: Simple, fast, no auth or backend  
**Cons**: Device-specific, limited size

### Option B: Supabase

- Requires `projects` table and RLS
- Use `user_id` when auth is added; until then, anonymous or device-bound
- Sync across devices if user is signed in

**Pros**: Persistent, multi-device  
**Cons**: Auth setup, migration, RLS design

### Recommendation

- Phase 1: **localStorage** for quick delivery
- Phase 2: Add Supabase when auth/multi-device is needed

---

## 3. Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/project.ts` | New – project types |
| `src/lib/projectStorage.ts` | New – load/save projects (localStorage or Supabase) |
| `src/hooks/useProjects.ts` | New – project list state, create/save/delete |
| `src/pages/Index.tsx` | Modify – use `activeProject`, save on change, switch |
| `src/components/TopBar.tsx` | Modify – add project switcher dropdown |
| `src/components/ProjectSwitcher.tsx` | New – dropdown UI |
| `src/App.tsx` | Optional – route `/projects/:id` if needed |

---

## 4. Implementation Flow

### 4.1 Project storage (`src/lib/projectStorage.ts`)

```ts
const STORAGE_KEY = "figma-to-code-projects";

export function loadProjects(): Project[] { ... }
export function saveProjects(projects: Project[]): void { ... }
export function createProject(name?: string): Project { ... }
```

### 4.2 useProjects hook (`src/hooks/useProjects.ts`)

- `projects: Project[]`
- `activeProject: Project | null`
- `setActiveProject(id)` – load project, trigger WebContainer remount
- `createProject()` – add new project, set as active
- `saveProject(project)` – persist
- `deleteProject(id)` – remove, switch to another if needed

### 4.3 Index.tsx changes

1. Replace raw state (`files`, `componentName`, `previewHtml`) with `activeProject` from `useProjects`.
2. **On conversion**:
   - Create new project (or update current) with `name: componentName`, `files`, `previewHtml`, etc.
   - Save via `saveProject`.
3. **On editor/visual-edit change**:
   - Debounced `saveProject(activeProject)` (e.g. 1–2s after last change).
4. **On project switch**:
   - `setActiveProject(id)` → load project → set `files`, `componentName`, `previewHtml`
   - Rebuild `FileSystemTree` from project files and call `bootAndMount(tree)` (WebContainer remount).

### 4.4 Project switcher (TopBar)

- Dropdown showing current project name
- List of projects; click to switch
- “New project” button → create blank project
- Optional: “Delete” on hover for each project

---

## 5. WebContainer Handling on Switch

When switching projects:

1. Stop current preview (optional; WebContainer can overwrite).
2. Build `FileSystemTree` from `project.files` via `extractReactPreviewFiles` + `buildPreviewProject`.
3. Call `bootAndMount(tree)`.
4. Store `tree` in `lastPreviewTreeRef` for Restart button.

**Edge cases**:

- Switching to a project with no React files → show static `previewHtml` only (no WebContainer).
- Switching to an empty project → show empty state; no preview.

---

## 6. Creating a New Project

**Option A: Blank project**

- `files: []`, `componentName: null`, `previewHtml: null`
- User pastes Figma URL and converts as usual.

**Option B: From conversion**

- Current behavior: conversion creates/updates the active project.
- "New project" before converting = create blank, then convert into it.

---

## 7. Routing (Optional)

- **Without routes**: Single page; `activeProjectId` in `useProjects` + localStorage.
- **With routes**: `/projects/:id` – `useParams` loads project by id; enables deep links and back button.

For phase 1, routing is optional. A query param `?project=xxx` or just in-memory state is enough.

---

## 8. Migration / First-Time Setup

- On first load, if `loadProjects()` is empty:
  - Option A: Start with one default project (empty).
  - Option B: No project until user creates or converts.
- If there is existing state in session (e.g. from before this feature): can offer “Save as project” to migrate.

---

## 9. Summary Checklist

- [x] Add `Project` type and `projectStorage.ts`
- [x] Add `useProjects` hook
- [x] Refactor `Index.tsx` to use `activeProject`
- [x] Add debounced save on editor/visual-edit changes
- [x] Add `ProjectSwitcher` component in TopBar
- [x] Implement project switch → load state + `bootAndMount`
- [x] Handle empty/blank projects (no preview)
- [ ] Add “New project” and optional “Delete project”
- [ ] (Phase 2) Supabase `projects` table + RLS if needed

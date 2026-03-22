# AST Targeting Plan (WebContainer + Injected Picker, Minimal Rewrite)

## Goal
Make Visual Edit target the **exact JSX element** the user clicked, using AST transforms, so edits are precise and reliable (no “nth `<div>`” guessing, fewer brittle selectors, fewer fallbacks).

This plan fits the current architecture:
- Preview runs in a WebContainer (Vite dev server).
- Element selection happens via an injected script inside the preview iframe.
- Code edits are applied by patching file contents in-memory and writing back into the WebContainer FS for HMR.

---

## Current pain points this solves
- **DOM → source mapping is heuristic**: current patching targets “the first matching tag/className” rather than the actual JSX node.
- **Selector brittleness**: CSS selectors with `nth-of-type` break easily across layout/rerenders.
- **Nested elements**: repeated structures can cause edits to hit the wrong element.
- **Text edits**: many cases render from props/vars; AST makes it possible to detect and handle those cases cleanly.

---

## Core idea
1. **Instrument the preview output** so each rendered element has a stable attribute like `data-ve-id="ve_123"`.
2. The injected picker script sends `veId` back to the parent on click.
3. Style/text edits parse the target file into an AST, find the JSX node with that `data-ve-id`, and patch the right part (`className`, `style`, text children, props).

This mirrors how “Lovable/Figma Make–style” editors keep edits precise:
- stable runtime identifiers + structured/AST edits instead of regex-only patching.

---

## Milestones

### Milestone A — Add stable IDs to preview output
**Goal**: ensure clicked DOM nodes can be mapped back to a JSX node deterministically.

**Where**
- Update: `src/lib/previewTemplate.ts` (during `getProjectFiles(...)` generation)
- Add: `src/lib/ast/instrumentVeIds.ts`

**What**
- Run an AST transform on preview TSX files before mounting into the WebContainer:
  - `src/components/<ComponentName>.tsx`
  - optionally `src/App.tsx` (template UI like “TOAST PREVIEW” headings)
- Add `data-ve-id="ve_<n>"` to each JSX opening element **unless it already has one**.

**ID strategy**
- Start simple: sequential IDs in traversal order (`ve_1`, `ve_2`, …).
- Optional upgrade: stable hash based on `(filePath + node.startOffset)` to reduce churn between regen runs.

**Why preview-only is safe**
- Preview project files are generated/mounted into WebContainer; instrumentation won’t pollute your actual repo output unless you choose to persist IDs.

---

### Milestone B — Picker sends `veId`
**Where**
- Update: `src/lib/previewInject.ts`
- Update types: `src/hooks/useVisualEdit.ts` (`SelectedElement`)

**What**
- On click, compute:
  - `const veId = target.closest('[data-ve-id]')?.getAttribute('data-ve-id')`
- Include it in the postMessage payload:

```js
window.parent.postMessage({ type: "ve-select", element: { veId, ... } }, "*");
```

---

### Milestone C — AST patcher edits by `veId`
**Goal**: patch the **exact** JSX node’s styling/text.

**Where**
- Add: `src/lib/ast/patchByVeId.ts`
- Wire into:
  - `src/hooks/useVisualEdit.ts` for style + text edits
  - `src/pages/Index.tsx` for AI edit targeting (optional early win)

**What to patch**
- **Style edits**
  - Prefer Tailwind class edits:
    - `className="..."` (string literal)
    - `className={cn(...)/clsx(...)}` (expression tree)
  - Use Tailwind arbitrary values when needed:
    - `bg-[#RRGGBB]`, `text-[#RRGGBB]`, `border-[#RRGGBB]`, `rounded-[12px]`, `p-[18px]`, …
- **Text edits**
  - Patch `JSXText` child nodes (`<h2>Hello</h2>`)
  - Patch literal expressions (`{"Hello"}`)
  - If the node uses a dynamic expression (`{title}`), surface a clear message:
    - either “dynamic text; use AI edit” or try patching local variable initializer if safe.

**Fallback policy**
- If `veId` is missing or no node found:
  - fall back to current heuristic patching (`codePatcher.ts`) to avoid regressions.

---

### Milestone D — AI Edit becomes AST-scoped (optional but high impact)
Current AI Edit replaces the whole file. A safer approach:
- Send the model a **small scope**: the selected JSX node (and minimal surrounding component context).
- Ask it to return a **structured edit** (or limited snippet).
- Apply with AST, then regenerate code.

This prevents the model from changing unrelated parts of the file.

---

### Milestone E — Undo/redo + patch history (nice-to-have)
- Store patch history per edit: `{ file, before, after, veId, timestamp }`
- Provide undo/redo controls in `VisualEditPanel`

---

## Recommended parser/tooling
**Option 1 (recommended)**: Babel toolchain (best JSX ergonomics)
- `@babel/parser`
- `@babel/traverse`
- `@babel/generator`
- `@babel/types`

**Option 2**: TypeScript compiler API
- Works, but more verbose for JSX manipulation.

---

## Expected file touch list
- Update: `src/lib/previewTemplate.ts` (instrument TSX during preview build)
- Update: `src/lib/previewInject.ts` (send `veId`)
- Update: `src/hooks/useVisualEdit.ts` (store `veId`, prefer AST patcher)
- Add: `src/lib/ast/instrumentVeIds.ts`
- Add: `src/lib/ast/patchByVeId.ts`

---

## Key decision: preview-only vs persisted IDs
Choose one mode (you can support both later):

- **Preview-only (recommended)**:
  - IDs exist only in WebContainer-mounted preview files.
  - Keeps exported/generated components clean.
  - Great for an editor workflow where preview is the editing surface.

- **Persist IDs**:
  - IDs are written back into exported code.
  - Enables stable edits across sessions and outside the preview context.
  - But it “pollutes” component markup with editor metadata.

---

## Validation checklist
- Clicking an element yields a `veId` and selects the correct node consistently.
- Background color edits update `className` in-place (including cn/clsx expressions), not via selector CSS overrides.
- Nested/repeated UI elements patch the correct occurrence.
- Text edits work for literal JSX text nodes; dynamic text surfaces a helpful message.
- No injection blocks or brittle selectors are written into TSX files.


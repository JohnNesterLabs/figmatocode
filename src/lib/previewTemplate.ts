/**
 * Base Vite + React + Tailwind project template for WebContainer preview.
 * Generates a FileSystemTree compatible with @webcontainer/api.
 */

import type { FileSystemTree } from "@webcontainer/api";

const BASE_PACKAGE_JSON = `{
  "name": "preview-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "vite": "^5.4.19"
  }
}`;

const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`;

const POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

const MAIN_TSX = `import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
`;

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 40px;
  background: #0a0a0a;
  color: #f5f5f5;
  font-family: system-ui, sans-serif;
  min-height: 100vh;
}
`;

/**
 * Build App.tsx that imports and renders the component.
 */
function buildAppTsx(componentName: string, componentPath: string): string {
  return `import ${componentName} from "${componentPath}";

function App() {
  return (
    <div className="p-6">
      <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-4">${componentName} Preview</h2>
      <${componentName} />
    </div>
  );
}

export default App;
`;
}

/**
 * Convert flat file map to nested FileSystemTree.
 */
function toFileSystemTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        (current as Record<string, { file: { contents: string } }>)[name] = {
          file: { contents: content },
        };
      } else {
        if (!(name in current)) {
          (current as Record<string, { directory: FileSystemTree }>)[name] = { directory: {} };
        }
        current = (current[name] as { directory: FileSystemTree }).directory;
      }
    }
  }
  return tree;
}

/**
 * Generate full Vite + React + Tailwind project for WebContainer.
 * Includes base template + generated component + App that renders it.
 */
export function buildPreviewProject(
  componentName: string,
  componentCode: string,
  componentCss: string
): FileSystemTree {
  const componentPath = `./components/${componentName}`;
  const appTsx = buildAppTsx(componentName, componentPath);
  const files: Record<string, string> = {
    "package.json": BASE_PACKAGE_JSON,
    "vite.config.ts": VITE_CONFIG,
    "index.html": INDEX_HTML,
    "tailwind.config.js": TAILWIND_CONFIG,
    "postcss.config.js": POSTCSS_CONFIG,
    "src/main.tsx": MAIN_TSX,
    "src/App.tsx": appTsx,
    "src/index.css": INDEX_CSS,
    [`src/components/${componentName}.tsx`]: componentCode,
    [`src/components/${componentName}.css`]: componentCss,
  };
  return toFileSystemTree(files);
}

/**
 * Extract React component code and CSS from CodeFile array.
 * Falls back to minimal placeholder if not found.
 */
export function extractReactPreviewFiles(
  files: { name: string; content: string }[],
  componentName: string
): { componentCode: string; componentCss: string } {
  const nameLower = componentName.toLowerCase();
  let componentCode = `export default function ${componentName}() {
  return <div className="p-4 text-zinc-400">No React output — select React in frameworks.</div>;
}`;
  let componentCss = `/* ${componentName} */`;

  const reactFile = files.find(
    (f) =>
      f.name.endsWith(".jsx") ||
      (f.name.endsWith(".tsx") && !f.name.endsWith(".lite.tsx") && f.content.includes("from \"react\""))
  );
  const cssFile = files.find((f) => f.name.endsWith(".css") && f.name.toLowerCase().includes(nameLower));

  if (reactFile?.content) {
    componentCode = reactFile.content;
  }
  if (cssFile?.content) {
    componentCss = cssFile.content;
  }

  return { componentCode, componentCss };
}

/**
 * Map WebContainer paths to CodeFile names for syncing editor content.
 * Use: contentForPath = editorContents[codeFileName] ?? files.find(f => f.name === codeFileName)?.content
 */
export function getPreviewPathToFileName(
  files: { name: string; content?: string }[],
  componentName: string
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const nameLower = componentName.toLowerCase();
  const reactFile = files.find(
    (f) =>
      f.name.endsWith(".jsx") ||
      (f.name.endsWith(".tsx") && !f.name.endsWith(".lite.tsx") && f.content?.includes?.("from \"react\""))
  );
  const cssFile = files.find(
    (f) => f.name.endsWith(".css") && f.name.toLowerCase().includes(nameLower)
  );
  if (reactFile) {
    mapping[`src/components/${componentName}.tsx`] = reactFile.name;
  }
  if (cssFile) {
    mapping[`src/components/${componentName}.css`] = cssFile.name;
  }
  return mapping;
}

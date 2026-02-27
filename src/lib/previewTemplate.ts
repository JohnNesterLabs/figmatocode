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
 */
export function buildPreviewProject(
  componentName: string,
  componentCode: string,
  componentCss: string
): FileSystemTree {
  const projectFiles = getProjectFiles(componentName, componentCode, componentCss);
  const fileMap: Record<string, string> = {};
  projectFiles.forEach((f) => {
    fileMap[f.name] = f.content;
  });
  return toFileSystemTree(fileMap);
}
export function getProjectFiles(
  componentName: string,
  componentCode: string,
  componentCss: string
): { name: string; content: string; language: string }[] {
  const componentPath = `./components/${componentName}`;
  const appTsx = buildAppTsx(componentName, componentPath);

  const rawFiles: Record<string, { content: string; language: string }> = {
    "package.json": { content: BASE_PACKAGE_JSON, language: "json" },
    "vite.config.ts": { content: VITE_CONFIG, language: "typescript" },
    "index.html": { content: INDEX_HTML, language: "html" },
    "tailwind.config.js": { content: TAILWIND_CONFIG, language: "javascript" },
    "postcss.config.js": { content: POSTCSS_CONFIG, language: "javascript" },
    "src/main.tsx": { content: MAIN_TSX, language: "typescript" },
    "src/App.tsx": { content: appTsx, language: "typescript" },
    "src/index.css": { content: INDEX_CSS, language: "css" },
    [`src/components/${componentName}.tsx`]: { content: componentCode, language: "typescript" },
    [`src/components/${componentName}.css`]: { content: componentCss, language: "css" },
  };

  return Object.entries(rawFiles).map(([name, data]) => ({
    name,
    content: data.content,
    language: data.language,
  }));
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

  // Look for generated files first, then project files
  const reactFile = files.find(
    (f) =>
      f.name.endsWith(".jsx") ||
      (f.name.endsWith(".tsx") && !f.name.endsWith(".lite.tsx") && f.content.includes("from \"react\"")) ||
      f.name === `src/components/${componentName}.tsx`
  );
  const cssFile = files.find(
    (f) =>
      (f.name.endsWith(".css") && f.name.toLowerCase().includes(nameLower)) ||
      f.name === `src/components/${componentName}.css`
  );

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
 * For the full project, names ARE the paths.
 */
export function getPreviewPathToFileName(
  files: { name: string; content?: string }[],
  componentName: string
): Record<string, string> {
  const mapping: Record<string, string> = {};

  // If we have full project paths (containing / or .html, .json etc), use identity mapping
  const hasProjectPaths = files.some(f => f.name.includes("/") || f.name.includes(".json") || f.name.includes(".html"));

  if (hasProjectPaths) {
    files.forEach(f => {
      // Only sync files that exist in the standard Vite project structure we mount
      if (f.name.startsWith("src/") || f.name.includes(".ts") || f.name.includes(".js") || f.name === "index.html" || f.name === "package.json") {
        mapping[f.name] = f.name;
      }
    });
    return mapping;
  }

  // Fallback for legacy "only 3 files" mode
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


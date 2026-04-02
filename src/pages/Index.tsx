import { useState, useCallback, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import SettingsSidebar from "@/components/SettingsSidebar";
import AppSidebar from "@/components/AppSidebar";
import HomeView from "@/components/HomeView";
import CodePanel, { CodeFile } from "@/components/CodePanel";
import PreviewPanel from "@/components/PreviewPanel";
import PushToGitHubDialog from "@/components/PushToGitHubDialog";
import VisualEditPanel from "@/components/VisualEditPanel";
import { ConversionStep } from "@/components/ConversionProgress";
import {
  extractComponentNameFromUrl,
  fetchFigmaNodeData,
  buildFigmaNodeSummaryFromRoot,
  getPreferredFigmaNode,
  simplifyFigmaForLLM,
} from "@/lib/figma";
import { getFigmaToken, getDeepSeekToken } from "@/lib/tokenStorage";
import { generateComponentWithDeepSeek, editElementWithAI, editJsxNodeWithAI } from "@/lib/deepseek";
import { useWebContainer } from "@/hooks/useWebContainer";
import { useVisualEdit } from "@/hooks/useVisualEdit";
import { useProjects } from "@/hooks/useProjects";
import {
  buildPreviewProject,
  extractReactPreviewFiles,
  getPreviewPathToFileName,
  getProjectFiles,
} from "@/lib/previewTemplate";
import type { FileSystemTree } from "@webcontainer/api";
import { extractJsxByVeId, replaceJsxByVeId } from "@/lib/ast/jsxByVeId";
import { FileCode, Eye, MessageSquare, History } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import ChatPanel from "@/components/ChatPanel";
import HistoryPanel from "@/components/HistoryPanel";
import { appendHistory } from "@/lib/projectHistory";

const MOCK_STEPS: Omit<ConversionStep, "status">[] = [
  { id: "fetch", label: "Fetching from Figma API", detail: "Downloading design data..." },
  { id: "parse", label: "Parsing variants & layers" },
  { id: "assets", label: "Exporting assets (SVG/PNG)" },
  { id: "generate", label: "AI-driven component generation" },
  { id: "compile", label: "Optimizing code & accessibility" },
  { id: "css", label: "Injecting CSS & tokens" },
];

const generateMockCode = (name: string, frameworks: string[], variants: string[]): CodeFile[] => {
  const files: CodeFile[] = [];
  const primaryLabel = (variants[0] || "Default").replace(/"/g, '\\"').replace(/\n/g, ' ');
  const secondaryLabel = (variants[1] || primaryLabel).replace(/"/g, '\\"').replace(/\n/g, ' ');

  files.push({
    name: `${name}.lite.tsx`,
    language: "typescript",
    content: `import { useState } from "@builder.io/mitosis";

export default function ${name}() {
  const [state, setState] = useState({
    variant: "primary",
    disabled: false,
  });

  return (
    <div class="${name.toLowerCase()}-root">
      <button
        class={\`btn btn--\${state.variant}\`}
        disabled={state.disabled}
        onClick={() => setState({ ...state, variant: "secondary" })}
      >
        {state.variant === "primary" ? "${primaryLabel}" : "${secondaryLabel}"}
      </button>
    </div>
  );
}`,
  });

  if (frameworks.includes("react")) {
    files.push({
      name: `${name}.jsx`,
      language: "javascript",
      content: `import React, { useState } from "react";
import "./${name}.css";

export default function ${name}() {
  const [variant, setVariant] = useState("primary");
  const [disabled] = useState(false);

  return (
    <div className="${name.toLowerCase()}-root">
      <button
        className={\`btn btn--\${variant}\`}
        disabled={disabled}
        onClick={() => setVariant("secondary")}
      >
        {variant === "primary" ? "${primaryLabel}" : "${secondaryLabel}"}
      </button>
    </div>
  );
}`,
    });
  }

  if (frameworks.includes("vue")) {
    files.push({
      name: `${name}.vue`,
      language: "html",
      content: `<template>
  <div class="${name.toLowerCase()}-root">
    <button
      :class="['btn', \`btn--\${variant}\`]"
      :disabled="disabled"
      @click="variant = 'secondary'"
    >
      Click me
    </button>
  </div>
</template>

<script setup>
import { ref } from "vue";

const variant = ref("primary");
const disabled = ref(false);
</script>

<style scoped>
@import "./${name}.css";
</style>`,
    });
  }

  if (frameworks.includes("svelte")) {
    files.push({
      name: `${name}.svelte`,
      language: "html",
      content: `<script>
  let variant = "primary";
  let disabled = false;
</script>

<div class="${name.toLowerCase()}-root">
  <button
    class="btn btn--{variant}"
    {disabled}
    on:click={() => variant = "secondary"}
  >
    Click me
  </button>
</div>

<style>
  @import "./${name}.css";
</style>`,
    });
  }

  if (frameworks.includes("angular")) {
    files.push({
      name: `${name.toLowerCase()}.component.ts`,
      language: "typescript",
      content: `import { Component } from "@angular/core";

@Component({
  selector: "app-${name.toLowerCase()}",
  template: \`
    <div class="${name.toLowerCase()}-root">
      <button
        [class]="'btn btn--' + variant"
        [disabled]="disabled"
        (click)="variant = 'secondary'"
      >
        Click me
      </button>
    </div>
  \`,
  styleUrls: ["./${name.toLowerCase()}.component.css"],
})
export class ${name}Component {
  variant = "primary";
  disabled = false;
}`,
    });
  }

  if (frameworks.includes("solid")) {
    files.push({
      name: `${name}.tsx`,
      language: "typescript",
      content: `import { createSignal } from "solid-js";
import "./${name}.css";

export default function ${name}() {
  const [variant, setVariant] = createSignal("primary");
  const [disabled] = createSignal(false);

  return (
    <div class="${name.toLowerCase()}-root">
      <button
        class={\`btn btn--\${variant()}\`}
        disabled={disabled()}
        onClick={() => setVariant("secondary")}
      >
        Click me
      </button>
    </div>
  );
}`,
    });
  }

  files.push({
    name: `${name}.css`,
    language: "css",
    content: `.${name.toLowerCase()}-root {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn--primary {
  background: #ef3139;
  color: #ffffff;
}

.btn--primary:hover {
  background: #d42a31;
}

.btn--secondary {
  background: #1a1a1a;
  color: #f5f5f5;
  border: 1px solid #333;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`,
  });

  return files;
};

const generatePreviewHtml = (name: string, variants: string[]): string => {
  const cards = (variants.length ? variants : ["Default"]).slice(0, 4).map((variant, index) => {
    return `<div class="variant-card">
      <button class="btn btn--${index % 2 === 0 ? "primary" : "secondary"}">${variant}</button>
      <span class="variant-label">${variant}</span>
    </div>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    :root, [data-preview-theme="dark"] {
      --preview-bg: #0a0a0a;
      --preview-fg: #f5f5f5;
      --preview-muted: #a1a1aa;
      --preview-card-bg: rgba(255,255,255,0.03);
      --preview-card-border: rgba(255,255,255,0.08);
      --preview-btn-secondary-bg: #1a1a1a;
      --preview-btn-secondary-fg: #f5f5f5;
      --preview-btn-secondary-border: #333;
    }
    [data-preview-theme="light"] {
      --preview-bg: #ffffff;
      --preview-fg: #18181b;
      --preview-muted: #71717a;
      --preview-card-bg: rgba(0,0,0,0.03);
      --preview-card-border: rgba(0,0,0,0.08);
      --preview-btn-secondary-bg: #f4f4f5;
      --preview-btn-secondary-fg: #18181b;
      --preview-btn-secondary-border: #d4d4d8;
    }
    body {
      margin: 0;
      padding: 40px;
      background: var(--preview-bg);
      color: var(--preview-fg);
      font-family: 'Poppins', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--preview-muted);
      margin: 0;
    }
    .variant-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 16px;
      width: 100%;
      max-width: 600px;
    }
    .variant-card {
      background: var(--preview-card-bg);
      border: 1px solid var(--preview-card-border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .variant-label {
      font-size: 10px;
      color: var(--preview-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    .btn--primary { background: #ef3139; color: #fff; }
    .btn--secondary { background: var(--preview-btn-secondary-bg); color: var(--preview-btn-secondary-fg); border: 1px solid var(--preview-btn-secondary-border); }
    .btn--primary:hover { background: #d42a31; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <h3>${name} — Variant Preview</h3>
  <div class="variant-grid">
    ${cards.join("")}
  </div>
  <script>
    window.addEventListener("message", function(e) {
      if (e.data && e.data.type === "preview-theme" && (e.data.theme === "light" || e.data.theme === "dark")) {
        document.documentElement.dataset.previewTheme = e.data.theme;
      }
    });
  <\/script>
</body>
</html>`;
};

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [steps, setSteps] = useState<ConversionStep[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [activeView, setActiveView] = useState<"code" | "preview">("preview");
  const [chatPanelView, setChatPanelView] = useState<"chat" | "history">("chat");
  const [historyVersion, setHistoryVersion] = useState(0);

  const {
    projects,
    activeProject,
    setActiveProject,
    createProject,
    updateActiveProject,
    deleteProject,
  } = useProjects();

  const files = activeProject?.files ?? [];
  const componentName = activeProject?.componentName ?? null;
  const previewHtml = activeProject?.previewHtml ?? null;

  const filesRef = useRef<CodeFile[]>([]);
  filesRef.current = files;
  const activeProjectRef = useRef(activeProject);
  activeProjectRef.current = activeProject;

  const {
    previewUrl,
    status: webContainerStatus,
    error: webContainerError,
    isSupported: isWebContainerSupported,
    bootAndMount,
    writeFiles,
  } = useWebContainer();

  const lastPreviewTreeRef = useRef<FileSystemTree | null>(null);

  // Remount WebContainer when switching projects (by id, not on in-place updates)
  const activeProjectId = activeProject?.id ?? null;
  useEffect(() => {
    if (!activeProject || !activeProjectId) return;

    if (
      isWebContainerSupported &&
      activeProject.componentName &&
      activeProject.files.length > 0
    ) {
      const { componentCode, componentCss } = extractReactPreviewFiles(
        activeProject.files.map((f) => ({ name: f.name, content: f.content })),
        activeProject.componentName
      );
      const tree = buildPreviewProject(
        activeProject.componentName,
        componentCode,
        componentCss,
        true
      );
      lastPreviewTreeRef.current = tree;
      bootAndMount(tree).catch(() => {});
    } else {
      lastPreviewTreeRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // ── Visual Edit state ──
  const primaryComponentFileName = componentName
    ? `src/components/${componentName}.tsx`
    : null;

  const {
    isVisualEditMode,
    selectedElement,
    editError,
    enterEditMode,
    exitEditMode,
    handleElementSelect,
    applyStyleEdit,
    applyTextEdit,
    applyAIEditResult,
  } = useVisualEdit({
    componentFileName: primaryComponentFileName,
    fallbackFileNames: ["src/App.tsx", "src/index.css"],
    getFileContent: (name) => {
      const f = filesRef.current.find((f) => f.name === name);
      return f?.content;
    },
    onFileUpdate: (fileName, newContent) => {
      const current = activeProjectRef.current;
      if (!current) return;
      const nextFiles = current.files.map((f) =>
        f.name === fileName ? { ...f, content: newContent } : f
      );
      updateActiveProject({ files: nextFiles });
      if (writeFiles) {
        writeFiles({ [fileName]: newContent }).catch(() => {/* handled in hook */ });
      }
    },
  });

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEditorChange = useCallback(
    (contents: Record<string, string>) => {
      const name = componentName;
      const currentFiles = filesRef.current;
      if (!name || !currentFiles.length) return;

      const pathToFileName = getPreviewPathToFileName(currentFiles, name);
      const toWrite: Record<string, string> = {};
      for (const [wcPath, codeFileName] of Object.entries(pathToFileName)) {
        const file = currentFiles.find((f) => f.name === codeFileName);
        const content = contents[codeFileName] ?? file?.content;
        if (content) toWrite[wcPath] = content;
      }
      if (Object.keys(toWrite).length > 0 && writeFiles) {
        writeFiles(toWrite).catch(() => {});
      }

      // Debounced save to project (persist to localStorage)
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        saveDebounceRef.current = null;
        const current = activeProjectRef.current;
        if (!current) return;
        const merged = current.files.map((f) => ({
          ...f,
          content: contents[f.name] ?? f.content,
        }));
        updateActiveProject({ files: merged });
      }, 1500);
    },
    [componentName, writeFiles, updateActiveProject]
  );

  const runConversion = useCallback(
    async (url: string, frameworks: string[]) => {
      const token = getFigmaToken();
      if (!token) {
        setError("Please add your Figma Access Token in the sidebar Configuration first.");
        return;
      }

      setError(null);
      setIsConverting(true);
      exitEditMode(); // Reset visual edit on new conversion

      let name = extractComponentNameFromUrl(url);
      let variants: string[] = ["Default"];

      const initialSteps: ConversionStep[] = MOCK_STEPS.map((s) => ({
        ...s,
        status: "pending",
      }));
      setSteps(initialSteps);

      for (let i = 0; i < initialSteps.length; i++) {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx === i ? "active" : idx < i ? "done" : "pending",
          }))
        );
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      }

      // All done
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
      await new Promise((r) => setTimeout(r, 500));
      setSteps([]);

      let generatedFiles: CodeFile[] = [];
      const deepseekToken = getDeepSeekToken();

      try {
        const rawFigmaData = await fetchFigmaNodeData(url, token);
        const nodeSummary = buildFigmaNodeSummaryFromRoot(url, rawFigmaData);
        name = nodeSummary.componentName;
        variants = nodeSummary.variantLabels;

        if (deepseekToken) {
          console.log("Using DeepSeek for generation...");
          const preferredNode = getPreferredFigmaNode(rawFigmaData) ?? rawFigmaData;
          let figmaForLLM = simplifyFigmaForLLM(preferredNode);
          let serialized = JSON.stringify(figmaForLLM);
          if (serialized.length > 380_000) {
            figmaForLLM = simplifyFigmaForLLM(preferredNode, {
              maxDepth: 18,
              maxNodes: 350,
              maxTextChars: 200,
              maxChildrenPerNode: 35,
            });
            serialized = JSON.stringify(figmaForLLM);
          }
          if (serialized.length > 450_000) {
            throw new Error(
              "This Figma selection is still too large for the AI context limit. Use a link that includes " +
                "?node-id=… pointed at a single frame or component (in Figma: right-click → Copy link to selection), or narrow your selection."
            );
          }
          const realCode = await generateComponentWithDeepSeek(name, figmaForLLM);
          generatedFiles = [
            { name: `${name}.tsx`, language: "typescript", content: realCode },
            { name: `${name}.css`, language: "css", content: `/* Stylings bundled in TSX via Tailwind */` }
          ];
        } else {
          generatedFiles = generateMockCode(name, frameworks, variants);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to fetch Figma node data.");
        setIsConverting(false);
        return;
      }

      const html = generatePreviewHtml(name, variants);

      if (isWebContainerSupported && frameworks.includes("react")) {
        const { componentCode, componentCss } = extractReactPreviewFiles(
          generatedFiles.map((f) => ({ name: f.name, content: f.content })),
          name
        );
        const projectFiles = getProjectFiles(name, componentCode, componentCss, true);
        const tree = buildPreviewProject(name, componentCode, componentCss, true);
        lastPreviewTreeRef.current = tree;
        updateActiveProject({
          files: projectFiles,
          componentName: name,
          previewHtml: html,
          figmaUrl: url,
          frameworks,
          name,
        });
        const projId = activeProjectRef.current?.id ?? "";
        appendHistory({
          projectId: projId,
          timestamp: new Date().toISOString(),
          type: "conversion",
          description: `Converted from Figma: ${name}`,
          filesSnapshot: projectFiles,
        });
        setHistoryVersion((v) => v + 1);
        bootAndMount(tree).catch(() => {
          // Error already set in hook
        });
      } else {
        updateActiveProject({
          files: generatedFiles,
          componentName: name,
          previewHtml: html,
          figmaUrl: url,
          frameworks,
          name,
        });
        appendHistory({
          projectId: activeProjectRef.current?.id ?? "",
          timestamp: new Date().toISOString(),
          type: "conversion",
          description: `Converted from Figma: ${name}`,
          filesSnapshot: generatedFiles,
        });
        setHistoryVersion((v) => v + 1);
      }

      setIsConverting(false);
    },
    [isWebContainerSupported, bootAndMount, exitEditMode, updateActiveProject]
  );

  const restartLivePreview = useCallback(() => {
    const tree = lastPreviewTreeRef.current;
    if (!tree) return;
    bootAndMount(tree).catch(() => {
      // Error already set in hook
    });
  }, [bootAndMount]);

  // ── AI Edit handler ──
  const handleAIEdit = useCallback(
    async (prompt: string) => {
      if (!selectedElement) return;

      // AI Edit should target the file that actually contains the selected element.
      // The preview template header often lives in src/App.tsx, not the component file.
      const candidates = [primaryComponentFileName, "src/App.tsx"].filter(
        (x): x is string => Boolean(x)
      );
      const files = filesRef.current;
      const selectedText = (selectedElement.textContent || "").trim();
      const veId = (selectedElement.veId || "").trim();

      const pickBestFile = () => {
        if (veId) {
          const needle = `data-ve-id="${veId}"`;
          for (const name of candidates) {
            const f = files.find((ff) => ff.name === name);
            if (!f) continue;
            if (f.content.includes(needle)) return f;
          }
        }
        for (const name of candidates) {
          const f = files.find((ff) => ff.name === name);
          if (!f) continue;
          if (selectedText && f.content.includes(selectedText)) return f;
        }
        // fallback to the primary component file if present, else first candidate found
        const primary = primaryComponentFileName
          ? files.find((ff) => ff.name === primaryComponentFileName)
          : undefined;
        return primary ?? files.find((ff) => candidates.includes(ff.name)) ?? null;
      };

      const file = pickBestFile();
      if (!file) throw new Error("No suitable file found for AI edit.");

      // Preferred: veId-scoped AI edit (edit just the JSX node, then apply via AST)
      if (veId) {
        const jsxRes = extractJsxByVeId(file.content, veId);
        if (jsxRes.ok) {
          const updatedJsx = await editJsxNodeWithAI(prompt, {
            veId,
            selector: selectedElement.selector,
            tagName: selectedElement.tagName,
            innerHTML: selectedElement.innerHTML,
            computedStyles: selectedElement.computedStyles,
            currentJsx: jsxRes.jsx,
          });
          const replaced = replaceJsxByVeId(file.content, veId, updatedJsx);
          if (replaced.ok) {
            const patched = replaced.code;
            const current = activeProjectRef.current;
            if (current) {
              updateActiveProject({
                files: current.files.map((f) =>
                  f.name === file.name ? { ...f, content: patched } : f
                ),
              });
            }
            if (writeFiles) {
              writeFiles({ [file.name]: patched }).catch(() => {
                /* handled in hook */
              });
            }
            return;
          }
          // If replacement failed, fall through to full-file AI edit
        }
      }

      // Fallback: full-file replacement AI edit
      const newCode = await editElementWithAI(
        prompt,
        {
          selector: selectedElement.selector,
          tagName: selectedElement.tagName,
          innerHTML: selectedElement.innerHTML,
          computedStyles: selectedElement.computedStyles,
        },
        file.content
      );
      const patched = newCode
        .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      const current = activeProjectRef.current;
      if (current) {
        updateActiveProject({
          files: current.files.map((f) =>
            f.name === file.name ? { ...f, content: patched } : f
          ),
        });
      }
      if (writeFiles) {
        writeFiles({ [file.name]: patched }).catch(() => {
          /* handled in hook */
        });
      }
    },
    [selectedElement, primaryComponentFileName, writeFiles, updateActiveProject]
  );

  const showHomeView = !activeProject || activeProject.files.length === 0;
  const handleNavigateHome = useCallback(() => {
    createProject();
  }, [createProject]);

  const handleChatApplyEdits = useCallback(
    (updates: Record<string, string>) => {
      const current = activeProjectRef.current;
      if (!current) return;
      const nextFiles = current.files.map((f) =>
        f.name in updates ? { ...f, content: updates[f.name] } : f
      );
      const newFileNames = Object.keys(updates).filter((name) => !current.files.some((f) => f.name === name));
      newFileNames.forEach((name) => nextFiles.push({ name, content: updates[name], language: "typescript" }));
      updateActiveProject({ files: nextFiles });
      if (writeFiles) writeFiles(updates).catch(() => {});
    },
    [updateActiveProject, writeFiles]
  );

  const handleChatHistoryEntry = useCallback(
    (type: "ai_edit", description: string, filesSnapshot: CodeFile[]) => {
      const current = activeProjectRef.current;
      if (!current) return;
      appendHistory({
        projectId: current.id,
        timestamp: new Date().toISOString(),
        type,
        description,
        filesSnapshot,
      });
      setHistoryVersion((v) => v + 1);
    },
    []
  );

  const handleHistoryRevert = useCallback(
    (snapshot: CodeFile[]) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateActiveProject({ files: snapshot });
      if (writeFiles) {
        const toWrite: Record<string, string> = {};
        snapshot.forEach((f) => { toWrite[f.name] = f.content; });
        writeFiles(toWrite).catch(() => {});
      }
    },
    [updateActiveProject, writeFiles]
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <AppSidebar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(id) => setActiveProject(id)}
        onCreateProject={createProject}
        onNavigateHome={handleNavigateHome}
        onOpenSettings={() => setSidebarOpen(true)}
      />
      {sidebarOpen && (
        <SettingsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {showHomeView ? (
          <HomeView
            onConvert={runConversion}
            steps={steps}
            isConverting={isConverting}
            error={error}
            componentName={componentName}
          />
        ) : (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={70} minSize={40}>
              <div className="h-full flex flex-col">
                <Tabs
                  value={activeView}
                  onValueChange={(v) => setActiveView(v as "code" | "preview")}
                  className="h-full flex flex-col"
                >
                  <div className="shrink-0 border-b border-border bg-card px-4 flex items-center justify-between">
                    <TabsList className="h-11 justify-start rounded-none border-0 bg-transparent p-0 gap-0">
                      <TabsTrigger
                        value="code"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground shadow-none"
                      >
                        <FileCode className="w-4 h-4 mr-2" />
                        Code
                      </TabsTrigger>
                      <TabsTrigger
                        value="preview"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground shadow-none"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </TabsTrigger>
                    </TabsList>
                    <ThemeToggle />
                  </div>
                  <div className="flex-1 flex overflow-hidden min-h-0">
                    <TabsContent value="code" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
                      <CodePanel
                        files={files}
                        onPushToGitHub={files.length > 0 ? () => setGithubDialogOpen(true) : undefined}
                        onEditorChange={files.length > 0 && componentName && isWebContainerSupported ? onEditorChange : undefined}
                      />
                    </TabsContent>
                    <TabsContent value="preview" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden flex">
                      <div className="flex-1 overflow-hidden min-w-0">
                        <PreviewPanel
                          previewUrl={previewUrl}
                          html={previewHtml}
                          status={webContainerStatus}
                          error={webContainerError}
                          isWebContainerSupported={isWebContainerSupported}
                          onRestartLivePreview={restartLivePreview}
                          isVisualEditMode={isVisualEditMode}
                          onEnterEditMode={enterEditMode}
                          onExitEditMode={exitEditMode}
                          onElementSelect={handleElementSelect}
                        />
                      </div>
                      {isVisualEditMode && selectedElement && (
                        <VisualEditPanel
                          element={selectedElement}
                          componentCode={
                            filesRef.current.find((f) => f.name === primaryComponentFileName)?.content ?? ""
                          }
                          onStyleChange={applyStyleEdit}
                          onTextChange={applyTextEdit}
                          onAIEdit={handleAIEdit}
                          onClose={exitEditMode}
                          editError={editError}
                        />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </ResizablePanel>
            <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
              <Tabs value={chatPanelView} onValueChange={(v) => setChatPanelView(v as "chat" | "history")} className="h-full flex flex-col">
                <div className="shrink-0 border-b border-border bg-card px-2">
                  <TabsList className="h-10 w-full justify-start rounded-none border-0 bg-transparent p-0 gap-0">
                    <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground shadow-none">
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground shadow-none">
                      <History className="w-3.5 h-3.5 mr-1.5" />
                      History
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <TabsContent value="chat" className="h-full m-0 data-[state=inactive]:hidden">
                    <ChatPanel
                      files={files}
                      componentName={componentName}
                      projectId={activeProject?.id ?? ""}
                      onApplyEdits={handleChatApplyEdits}
                      onHistoryEntry={handleChatHistoryEntry}
                    />
                  </TabsContent>
                  <TabsContent value="history" className="h-full m-0 data-[state=inactive]:hidden">
                    <HistoryPanel key={`${activeProject?.id}-${historyVersion}`} projectId={activeProject?.id ?? ""} onRevert={handleHistoryRevert} />
                  </TabsContent>
                </div>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>
      <PushToGitHubDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        files={files}
        componentName={componentName || "Component"}
      />
    </div>
  );
};

export default Index;

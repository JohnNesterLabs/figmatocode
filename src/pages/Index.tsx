import { useState, useCallback } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import TopBar from "@/components/TopBar";
import SettingsSidebar from "@/components/SettingsSidebar";
import ImportPanel from "@/components/ImportPanel";
import CodePanel, { CodeFile } from "@/components/CodePanel";
import PreviewPanel from "@/components/PreviewPanel";
import PushToGitHubDialog from "@/components/PushToGitHubDialog";
import { ConversionStep } from "@/components/ConversionProgress";

const MOCK_STEPS: Omit<ConversionStep, "status">[] = [
  { id: "fetch", label: "Fetching from Figma API", detail: "Downloading design data..." },
  { id: "parse", label: "Parsing variants & layers" },
  { id: "assets", label: "Exporting assets (SVG/PNG)" },
  { id: "generate", label: "Generating Mitosis component" },
  { id: "compile", label: "Compiling to target frameworks" },
  { id: "css", label: "Injecting CSS & tokens" },
];

const generateMockCode = (name: string, frameworks: string[]): CodeFile[] => {
  const files: CodeFile[] = [];

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
        Click me
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
        Click me
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

const generatePreviewHtml = (name: string): string => {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 40px;
      background: #0a0a0a;
      color: #f5f5f5;
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
      color: #a1a1aa;
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
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .variant-label {
      font-size: 10px;
      color: #71717a;
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
    .btn--secondary { background: #1a1a1a; color: #f5f5f5; border: 1px solid #333; }
    .btn--primary:hover { background: #d42a31; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <h3>${name} — Variant Preview</h3>
  <div class="variant-grid">
    <div class="variant-card">
      <button class="btn btn--primary">Primary</button>
      <span class="variant-label">primary / default</span>
    </div>
    <div class="variant-card">
      <button class="btn btn--secondary">Secondary</button>
      <span class="variant-label">secondary / default</span>
    </div>
    <div class="variant-card">
      <button class="btn btn--primary" disabled>Primary</button>
      <span class="variant-label">primary / disabled</span>
    </div>
    <div class="variant-card">
      <button class="btn btn--secondary" disabled>Secondary</button>
      <span class="variant-label">secondary / disabled</span>
    </div>
  </div>
</body>
</html>`;
};

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [steps, setSteps] = useState<ConversionStep[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentName, setComponentName] = useState<string | null>(null);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);

  const simulateConversion = useCallback(
    async (url: string, frameworks: string[]) => {
      const token = localStorage.getItem("figma_token");
      if (!token) {
        setError("Please add your Figma Access Token in Settings first.");
        return;
      }

      setError(null);
      setIsConverting(true);
      setComponentName(null);
      setFiles([]);
      setPreviewHtml(null);

      // Extract a component name from URL
      const urlParts = url.split("/");
      const rawName = urlParts[urlParts.length - 1] || "MyComponent";
      const name = rawName
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/[-_ ]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (_, c) => c.toUpperCase()) || "MyComponent";

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

      const generatedFiles = generateMockCode(name, frameworks);
      setFiles(generatedFiles);
      setPreviewHtml(generatePreviewHtml(name));
      setComponentName(name);
      setIsConverting(false);
    },
    []
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <SettingsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <ImportPanel
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              onConvert={simulateConversion}
              steps={steps}
              isConverting={isConverting}
              error={error}
              componentName={componentName}
            />
          </ResizablePanel>
          <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
          <ResizablePanel defaultSize={45} minSize={30}>
            <CodePanel
              files={files}
              onPushToGitHub={files.length > 0 ? () => setGithubDialogOpen(true) : undefined}
            />
          </ResizablePanel>
          </ResizablePanel>
          <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
          <ResizablePanel defaultSize={30} minSize={20}>
            <PreviewPanel html={previewHtml} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
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

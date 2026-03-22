import type { CodeFile } from "@/components/CodePanel";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  figmaUrl?: string;
  frameworks?: string[];
  files: CodeFile[];
  componentName: string | null;
  previewHtml: string | null;
}

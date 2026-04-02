import type { Project } from "@/types/project";

const STORAGE_KEY = "figma-to-code-projects";
const ACTIVE_PROJECT_KEY = "figma-to-code-active-project-id";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Project =>
        p &&
        typeof p === "object" &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        Array.isArray(p.files) &&
        (p.componentName === null || typeof p.componentName === "string") &&
        (p.previewHtml === null || typeof p.previewHtml === "string")
    );
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore storage errors (quota, private mode, etc.)
  }
}

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

export function createProject(name?: string): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name || "Untitled Project",
    createdAt: now,
    updatedAt: now,
    files: [],
    componentName: null,
    previewHtml: null,
  };
}

import type { CodeFile } from "@/components/CodePanel";

export interface HistoryEntry {
  id: string;
  projectId: string;
  timestamp: string;
  type: "conversion" | "ai_edit" | "manual";
  description: string;
  filesSnapshot: CodeFile[];
}

const HISTORY_KEY_PREFIX = "figma-to-code-history-";
const MAX_ENTRIES_PER_PROJECT = 50;

function getHistoryKey(projectId: string): string {
  return `${HISTORY_KEY_PREFIX}${projectId}`;
}

export function loadHistory(projectId: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getHistoryKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is HistoryEntry =>
          e &&
          typeof e === "object" &&
          typeof e.id === "string" &&
          typeof e.timestamp === "string" &&
          Array.isArray(e.filesSnapshot)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}

export function appendHistory(entry: Omit<HistoryEntry, "id">): void {
  if (typeof window === "undefined") return;
  try {
    const fullEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
    };
    const key = getHistoryKey(entry.projectId);
    const existing = loadHistory(entry.projectId);
    const next = [fullEntry, ...existing].slice(0, MAX_ENTRIES_PER_PROJECT);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

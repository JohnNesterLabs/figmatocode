import { useState, useCallback, useEffect } from "react";
import type { Project } from "@/types/project";
import {
  loadProjects,
  saveProjects,
  createProject as createProjectStorage,
  getActiveProjectId,
  setActiveProjectId,
} from "@/lib/projectStorage";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const loaded = loadProjects();
    if (loaded.length === 0) {
      const defaultProject = createProjectStorage("Untitled Project");
      const next = [defaultProject];
      saveProjects(next);
      setActiveProjectId(defaultProject.id);
      return next;
    }
    return loaded;
  });
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    const loaded = loadProjects();
    const savedId = getActiveProjectId();
    if (savedId && loaded.some((p) => p.id === savedId)) return savedId;
    return loaded[0]?.id ?? null;
  });

  const activeProject =
    activeProjectId != null
      ? projects.find((p) => p.id === activeProjectId) ?? null
      : null;

  // Persist active project id when it changes
  useEffect(() => {
    setActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  const saveProject = useCallback((project: Project) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === project.id ? { ...project, updatedAt: new Date().toISOString() } : p));
      saveProjects(next);
      return next;
    });
  }, []);

  const createProject = useCallback(() => {
    const project = createProjectStorage();
    setProjects((prev) => {
      const next = [...prev, project];
      saveProjects(next);
      return next;
    });
    setActiveProjectIdState(project.id);
    return project;
  }, []);

  const setActiveProject = useCallback((id: string | null) => {
    setActiveProjectIdState(id);
  }, []);

  const updateActiveProject = useCallback(
    (updates: Partial<Omit<Project, "id" | "createdAt">>) => {
      const current = activeProject;
      if (!current) return;
      const updated: Project = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
    },
    [activeProject, saveProject]
  );

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        saveProjects(next);
        return next;
      });
      if (activeProjectId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        const nextActive = remaining.length > 0 ? remaining[0].id : null;
        setActiveProjectIdState(nextActive);
      }
    },
    [activeProjectId, projects]
  );

  return {
    projects,
    activeProject,
    activeProjectId,
    setActiveProject,
    createProject,
    saveProject,
    updateActiveProject,
    deleteProject,
  };
}

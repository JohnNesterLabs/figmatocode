import { Figma } from "lucide-react";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import type { Project } from "@/types/project";

interface TopBarProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
}

const TopBar = ({
  projects,
  activeProject,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}: TopBarProps) => {
  return (
    <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Figma className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">
              Figma → Code
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Design to production-ready components
            </p>
          </div>
        </div>
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-surface border border-border font-mono">
          v0.1.0
        </span>
      </div>
    </header>
  );
};

export default TopBar;

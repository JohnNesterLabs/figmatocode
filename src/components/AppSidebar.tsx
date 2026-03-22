import { useState, useEffect } from "react";
import { Home, Search, User, Plus, Star, Eye, EyeOff } from "lucide-react";
import { Figma } from "lucide-react";
import { getFigmaToken, setFigmaToken } from "@/lib/tokenStorage";
import { formatRelativeTime } from "@/lib/formatTime";
import type { Project } from "@/types/project";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-emerald-500/20 text-emerald-500",
  "bg-amber-500/20 text-amber-500",
  "bg-blue-500/20 text-blue-500",
  "bg-violet-500/20 text-violet-500",
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

interface AppSidebarProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onNavigateHome?: () => void;
  onOpenSettings?: () => void;
}

const AppSidebar = ({
  projects,
  activeProject,
  onSelectProject,
  onCreateProject,
  onNavigateHome,
  onOpenSettings,
}: AppSidebarProps) => {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setToken(getFigmaToken());
  }, []);

  const handleSaveToken = () => {
    setFigmaToken(token);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasToken = Boolean(getFigmaToken());

  return (
    <aside className="relative h-full w-60 flex flex-col bg-card border-r border-border shrink-0">
      {/* Logo & Nav */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Figma className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground truncate">Figma → Code</span>
        </div>
        <nav className="mt-4 flex flex-col gap-0.5">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-foreground hover:bg-surface-hover transition-colors text-left"
            >
              <Home className="w-4 h-4 text-muted-foreground" />
              Home
            </button>
            <button
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors text-left opacity-60 cursor-not-allowed"
              disabled
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors text-left"
            >
              <User className="w-4 h-4" />
              Profile
            </button>
          </nav>
      </div>

      {/* Projects */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Projects
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-2">
            <button
              onClick={onCreateProject}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors text-left mb-1"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>New project</span>
            </button>
            {projects.map((p, i) => {
              const isActive = activeProject?.id === p.id;
              const initial = p.name.charAt(0).toUpperCase();
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-left transition-colors mb-0.5",
                    isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                      getAvatarColor(i)
                    )}
                  >
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatRelativeTime(p.updatedAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      {/* Configuration */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Configuration
            </span>
          </div>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Figma Access Token"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-9"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={handleSaveToken}
            className="w-full py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {saved ? "Token saved" : "Save Token"}
          </button>
        </div>

      {/* Footer status */}
        <div className="p-4 border-t border-border flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full shrink-0", hasToken ? "bg-success" : "bg-muted-foreground/50")} />
          <span className="text-[10px] text-muted-foreground">
            {hasToken ? "Ready to convert" : "Add token to start"}
          </span>
        </div>
    </aside>
  );
};

export default AppSidebar;

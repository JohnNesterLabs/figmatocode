import { useState, useEffect } from "react";
import { Eye, EyeOff, Settings, User, ChevronLeft, GitBranch, Check as CheckIcon } from "lucide-react";

interface SettingsSidebarProps {
  open: boolean;
  onClose: () => void;
}

const SettingsSidebar = ({ open, onClose }: SettingsSidebarProps) => {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("figma_token");
    if (stored) setToken(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem("figma_token", token);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="w-64 h-full border-r border-border bg-card flex flex-col animate-slide-in">
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Figma Access Token
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="figd_..."
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-9"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSave}
            className="w-full py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {saved ? "✓ Saved" : "Save Token"}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            GitHub
          </label>
          <button className="w-full py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">
            Connect GitHub →
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Guest User</p>
            <p className="text-[10px] text-muted-foreground">Not connected</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
};

export default SettingsSidebar;

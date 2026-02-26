import { useState } from "react";
import { Send, Settings, Figma } from "lucide-react";
import FrameworkChips from "./FrameworkChips";
import ConversionProgress, { ConversionStep } from "./ConversionProgress";

interface ImportPanelProps {
  onToggleSidebar: () => void;
  onConvert: (url: string, frameworks: string[]) => void;
  steps: ConversionStep[];
  isConverting: boolean;
  error: string | null;
  componentName: string | null;
}

const ImportPanel = ({
  onToggleSidebar,
  onConvert,
  steps,
  isConverting,
  error,
  componentName,
}: ImportPanelProps) => {
  const [url, setUrl] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["react"]);

  const handleSubmit = () => {
    if (!url.trim() || isConverting) return;
    onConvert(url.trim(), frameworks);
  };

  const isValidUrl = url.includes("figma.com/design/") || url.includes("figma.com/file/");

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Figma className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Import Design</span>
        </div>
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-3 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive font-medium">{error}</p>
          </div>
        )}

        {steps.length > 0 ? (
          <ConversionProgress steps={steps} />
        ) : componentName ? (
          <div className="p-6 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Figma className="w-6 h-6 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">{componentName}</p>
            <p className="text-xs text-muted-foreground mt-1">Conversion complete</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
                <Figma className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">Paste a Figma design URL below</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                figma.com/design/...
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border space-y-3">
        <FrameworkChips selected={frameworks} onChange={setFrameworks} />
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Paste Figma URL..."
            className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSubmit}
            disabled={!isValidUrl || isConverting || frameworks.length === 0}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPanel;

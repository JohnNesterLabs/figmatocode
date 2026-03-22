import { useState } from "react";
import { Send, Plus, Mic, LayoutGrid } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import FrameworkChips from "./FrameworkChips";
import ConversionProgress, { type ConversionStep } from "./ConversionProgress";
import { parseFigmaUrl } from "@/lib/figma";

interface HomeViewProps {
  onConvert: (url: string, frameworks: string[]) => void;
  steps: ConversionStep[];
  isConverting: boolean;
  error: string | null;
  componentName: string | null;
}

const HomeView = ({
  onConvert,
  steps,
  isConverting,
  error,
  componentName,
}: HomeViewProps) => {
  const [url, setUrl] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["react"]);

  const handleSubmit = () => {
    if (!url.trim() || isConverting) return;
    onConvert(url.trim(), frameworks);
  };

  const isValidUrl = Boolean(parseFigmaUrl(url));

  return (
    <div className="h-full flex flex-col bg-background relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {steps.length > 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <ConversionProgress steps={steps} />
        </div>
      ) : componentName ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
            <Send className="w-8 h-8 text-success" />
          </div>
          <p className="text-lg font-semibold text-foreground">{componentName}</p>
          <p className="text-sm text-muted-foreground mt-1">Conversion complete — switch to Code or Preview to view</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center">
            What would you like to convert?
          </h2>
          <p className="text-muted-foreground text-center mt-3 mb-8">
            Paste a Figma URL to turn your design into production-ready code.
          </p>

          <div className="w-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
                title="Add attachment"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Convert Figma to production-ready React code"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors opacity-60"
                  title="Voice input (coming soon)"
                  disabled
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValidUrl || isConverting || frameworks.length === 0}
                  className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Frameworks</p>
              <div className="flex flex-wrap gap-2">
                <FrameworkChips selected={frameworks} onChange={setFrameworks} />
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Start with template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;

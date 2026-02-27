import { useState } from "react";
import { Eye, RefreshCw, Loader2, AlertCircle } from "lucide-react";

interface PreviewPanelProps {
  /** WebContainer live preview URL (Vite dev server) — preferred when available */
  previewUrl?: string | null;
  /** Static HTML fallback when WebContainer not supported or not ready */
  html?: string | null;
  /** Status for loading/error indication */
  status?: "idle" | "booting" | "mounting" | "installing" | "starting" | "ready" | "error";
  error?: string | null;
  isWebContainerSupported?: boolean;
}

const PreviewPanel = ({
  previewUrl,
  html,
  status = "idle",
  error,
  isWebContainerSupported = true,
}: PreviewPanelProps) => {
  const [frameKey, setFrameKey] = useState(0);

  const useLivePreview = isWebContainerSupported && previewUrl;
  const useStaticFallback = html && !useLivePreview;
  const isLoading = status === "booting" || status === "mounting" || status === "installing" || status === "starting";
  const hasError = status === "error" && error;

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Preview</span>
          {useLivePreview && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
              Live
            </span>
          )}
        </div>
        {(useLivePreview || useStaticFallback) && (
          <button
            onClick={() => setFrameKey((prev) => prev + 1)}
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
            title="Reload preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {status === "booting" && "Starting WebContainer..."}
              {status === "mounting" && "Mounting project..."}
              {status === "installing" && "Installing dependencies..."}
              {status === "starting" && "Starting Vite dev server..."}
            </p>
          </div>
        )}

        {hasError && !useStaticFallback && (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        {hasError && useStaticFallback && (
          <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive truncate flex-1">{error}</p>
          </div>
        )}

        {!isLoading && useLivePreview && (
          <iframe
            key={frameKey}
            src={previewUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Live Component Preview"
          />
        )}

        {!isLoading && !useLivePreview && useStaticFallback && (
          <iframe
            key={frameKey}
            srcDoc={html}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="Component Preview"
          />
        )}

        {!isLoading && !useLivePreview && !useStaticFallback && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Eye className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Convert a Figma design</p>
              <p className="text-xs text-muted-foreground/50 mt-1">to see the preview</p>
              {!isWebContainerSupported && (
                <p className="text-[10px] text-muted-foreground/70 mt-2 max-w-[200px] mx-auto">
                  Use Chrome or Edge for live Vite preview
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;

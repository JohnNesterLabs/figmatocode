import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Eye, RefreshCw, Loader2, AlertCircle, Pencil, PencilOff } from "lucide-react";
import { SelectedElement } from "@/hooks/useVisualEdit";

interface PreviewPanelProps {
  /** WebContainer live preview URL (Vite dev server) — preferred when available */
  previewUrl?: string | null;
  /** Static HTML fallback when WebContainer not supported or not ready */
  html?: string | null;
  /** Status for loading/error indication */
  status?: "idle" | "booting" | "mounting" | "installing" | "starting" | "ready" | "error";
  error?: string | null;
  isWebContainerSupported?: boolean;
  /** Restart the WebContainer live preview (re-run bootAndMount) */
  onRestartLivePreview?: () => void;

  // ── Visual Edit props ──
  isVisualEditMode?: boolean;
  onEnterEditMode?: () => void;
  onExitEditMode?: () => void;
  onElementSelect?: (element: SelectedElement) => void;
}

const PreviewPanel = ({
  previewUrl,
  html,
  status = "idle",
  error,
  isWebContainerSupported = true,
  onRestartLivePreview,
  isVisualEditMode = false,
  onEnterEditMode,
  onExitEditMode,
  onElementSelect,
}: PreviewPanelProps) => {
  const [frameKey, setFrameKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const staticIframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const { resolvedTheme } = useTheme();

  const useLivePreview = isWebContainerSupported && previewUrl;
  const useStaticFallback = html && !useLivePreview;
  const isLoading = status === "booting" || status === "mounting" || status === "installing" || status === "starting";
  const hasError = status === "error" && error;
  const canVisualEdit = Boolean(useLivePreview) && !isLoading;
  const canRestartLive = Boolean(isWebContainerSupported) && Boolean(onRestartLivePreview) && !isLoading;

  // ── postMessage bridge: send enable/disable to iframe ──
  const postToFrame = useCallback((msg: object) => {
    const frame = iframeRef.current;
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(msg, "*");
  }, []);

  const postToAnyFrame = useCallback((msg: object) => {
    [iframeRef.current, staticIframeRef.current].forEach((frame) => {
      if (frame?.contentWindow) frame.contentWindow.postMessage(msg, "*");
    });
  }, []);

  // When visual edit mode changes, tell the iframe to enable/disable
  useEffect(() => {
    if (!iframeReady) return;
    if (isVisualEditMode) {
      postToFrame({ type: "ve-enable" });
    } else {
      postToFrame({ type: "ve-disable" });
    }
  }, [isVisualEditMode, iframeReady, postToFrame]);

  // Post theme to preview iframe so it matches app theme
  useEffect(() => {
    const theme = resolvedTheme === "light" ? "light" : "dark";
    postToAnyFrame({ type: "preview-theme", theme });
  }, [resolvedTheme, postToAnyFrame]);

  // Also re-send enable after iframe reloads
  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
    const theme = resolvedTheme === "light" ? "light" : "dark";
    postToFrame({ type: "preview-theme", theme });
    if (isVisualEditMode) {
      setTimeout(() => postToFrame({ type: "ve-enable" }), 200);
    }
  }, [isVisualEditMode, resolvedTheme, postToFrame]);

  // ── Listen for messages from iframe ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "ve-select" && onElementSelect) {
        onElementSelect(e.data.element as SelectedElement);
      }
      if (e.data.type === "ve-ready") {
        // iframe confirmed it's in edit mode
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onElementSelect]);

  // Reset iframe-ready when preview URL changes
  useEffect(() => {
    setIframeReady(false);
  }, [previewUrl, frameKey]);

  const toggleEditMode = () => {
    if (isVisualEditMode) {
      onExitEditMode?.();
    } else {
      onEnterEditMode?.();
    }
  };

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
          {isVisualEditMode && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium animate-pulse">
              Editing
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Visual Edit toggle — only show for live WebContainer preview */}
          {canVisualEdit && (
            <button
              onClick={toggleEditMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isVisualEditMode
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover border border-border"
              }`}
              title={isVisualEditMode ? "Exit edit mode" : "Enter visual edit mode"}
            >
              {isVisualEditMode ? (
                <>
                  <PencilOff className="w-3.5 h-3.5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </>
              )}
            </button>
          )}
          {(useLivePreview || useStaticFallback) && (
            <button
              onClick={() => {
                if (hasError && canRestartLive) {
                  onRestartLivePreview?.();
                  return;
                }
                setIframeReady(false);
                setFrameKey((prev) => prev + 1);
              }}
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
              title={hasError && canRestartLive ? "Restart live preview" : "Reload preview"}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visual edit instructions banner */}
      {isVisualEditMode && canVisualEdit && (
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
          <Pencil className="w-3 h-3 text-primary shrink-0" />
          <p className="text-[11px] text-primary/80">
            Click any element in the preview to select and edit it
          </p>
        </div>
      )}

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
            {canRestartLive && (
              <button
                onClick={() => onRestartLivePreview?.()}
                className="text-[11px] px-2 py-1 rounded-md bg-destructive/15 text-destructive hover:bg-destructive/20 transition-colors"
                title="Restart live preview"
              >
                Restart
              </button>
            )}
          </div>
        )}

        {!isLoading && useLivePreview && (
          <iframe
            key={frameKey}
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Live Component Preview"
            onLoad={handleIframeLoad}
            style={isVisualEditMode ? { cursor: "crosshair" } : undefined}
          />
        )}

        {!isLoading && !useLivePreview && useStaticFallback && (
          <iframe
            key={frameKey}
            ref={staticIframeRef}
            srcDoc={html}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Component Preview"
            onLoad={() => {
              const theme = resolvedTheme === "light" ? "light" : "dark";
              staticIframeRef.current?.contentWindow?.postMessage({ type: "preview-theme", theme }, "*");
            }}
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
                  Use Chrome or Edge for live Vite preview &amp; visual editing
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

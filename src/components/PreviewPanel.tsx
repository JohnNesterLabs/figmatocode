import { Eye, RefreshCw } from "lucide-react";

interface PreviewPanelProps {
  html: string | null;
}

const PreviewPanel = ({ html }: PreviewPanelProps) => {
  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Preview</span>
        </div>
        {html && (
          <button className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {html ? (
          <iframe
            srcDoc={html}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="Component Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Eye className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Convert a Figma design</p>
              <p className="text-xs text-muted-foreground/50 mt-1">to see the preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;

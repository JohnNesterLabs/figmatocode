import { History, RotateCcw } from "lucide-react";
import { loadHistory, formatHistoryTime, type HistoryEntry } from "@/lib/projectHistory";

interface HistoryPanelProps {
  projectId: string;
  onRevert: (snapshot: HistoryEntry["filesSnapshot"]) => void;
}

const typeLabels: Record<HistoryEntry["type"], string> = {
  conversion: "Conversion",
  ai_edit: "AI Edit",
  manual: "Manual Edit",
};

const HistoryPanel = ({ projectId, onRevert }: HistoryPanelProps) => {
  const entries = loadHistory(projectId);

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-12 flex items-center gap-2 px-4 border-b border-border">
        <History className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Change History</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No changes yet</p>
            <p className="text-xs mt-1">Edits and conversions will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-start gap-2 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {typeLabels[entry.type]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatHistoryTime(entry.timestamp)}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1 truncate" title={entry.description}>
                    {entry.description}
                  </p>
                </div>
                <button
                  onClick={() => onRevert(entry.filesSnapshot)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  title="Revert to this state"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;

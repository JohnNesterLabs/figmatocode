import { useState, useEffect } from "react";
import { Download, Copy, Check, FileCode, GitBranch } from "lucide-react";
import Editor from "@monaco-editor/react";

export interface CodeFile {
  name: string;
  language: string;
  content: string;
}

interface CodePanelProps {
  files: CodeFile[];
  onPushToGitHub?: () => void;
}

const CodePanel = ({ files }: CodePanelProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [editorContents, setEditorContents] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    files.forEach((f) => {
      initial[f.name] = f.content;
    });
    setEditorContents(initial);
    setActiveTab(0);
  }, [files]);

  const handleCopy = () => {
    const file = files[activeTab];
    if (!file) return;
    navigator.clipboard.writeText(editorContents[file.name] || file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentFile = files[activeTab];

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Code</span>
        </div>
        {files.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
              title="Download ZIP"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex border-b border-border overflow-x-auto">
          {files.map((file, i) => (
            <button
              key={file.name}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-2 text-xs font-mono whitespace-nowrap border-b-2 transition-colors ${
                i === activeTab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {currentFile ? (
          <Editor
            height="100%"
            language={currentFile.language}
            value={editorContents[currentFile.name] || currentFile.content}
            onChange={(val) => {
              if (val !== undefined && currentFile) {
                setEditorContents((prev) => ({ ...prev, [currentFile.name]: val }));
              }
            }}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              lineNumbers: "on",
              renderLineHighlight: "none",
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileCode className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No code generated yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodePanel;

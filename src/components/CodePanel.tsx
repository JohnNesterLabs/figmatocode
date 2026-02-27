import { useMemo, useState, useEffect } from "react";
import {
  Download,
  Copy,
  Check,
  FileCode,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  X,
} from "lucide-react";
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

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
}

const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
  [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

const buildFileTree = (files: CodeFile[]): TreeNode[] => {
  const root: TreeNode[] = [];

  files.forEach((file) => {
    const parts = file.name.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = index === parts.length - 1;
      const existing = currentLevel.find((node) => node.name === part);
      if (existing) {
        if (existing.type === "folder" && existing.children) {
          currentLevel = existing.children;
        }
        return;
      }

      if (isLast) {
        currentLevel.push({ name: part, path: currentPath, type: "file" });
        return;
      }

      const folderNode: TreeNode = {
        name: part,
        path: currentPath,
        type: "folder",
        children: [],
      };
      currentLevel.push(folderNode);
      currentLevel = folderNode.children!;
    });
  });

  const sortRecursively = (nodes: TreeNode[]): TreeNode[] =>
    sortNodes(nodes).map((node) =>
      node.type === "folder" && node.children
        ? { ...node, children: sortRecursively(node.children) }
        : node
    );

  return sortRecursively(root);
};

const getParentFolders = (path: string): string[] => {
  const parts = path.split("/").filter(Boolean);
  const parents: string[] = [];
  for (let i = 1; i < parts.length; i += 1) {
    parents.push(parts.slice(0, i).join("/"));
  }
  return parents;
};

const CodePanel = ({ files, onPushToGitHub }: CodePanelProps) => {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [editorContents, setEditorContents] = useState<Record<string, string>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const fileByPath = useMemo(
    () => Object.fromEntries(files.map((file) => [file.name, file])),
    [files]
  );

  useEffect(() => {
    const initial: Record<string, string> = {};
    files.forEach((f) => {
      initial[f.name] = f.content;
    });
    setEditorContents(initial);

    setOpenFiles((prev) => {
      const next = prev.filter((path) => Boolean(fileByPath[path]));
      if (next.length > 0) return next;
      return files[0] ? [files[0].name] : [];
    });

    setActiveFilePath((prev) => {
      if (prev && fileByPath[prev]) return prev;
      return files[0]?.name ?? null;
    });

    const nextExpanded: Record<string, boolean> = {};
    files.forEach((file) => {
      getParentFolders(file.name).forEach((folderPath) => {
        nextExpanded[folderPath] = true;
      });
    });
    setExpandedFolders(nextExpanded);
  }, [files, fileByPath]);

  const handleCopy = () => {
    const file = activeFilePath ? fileByPath[activeFilePath] : undefined;
    if (!file) return;
    navigator.clipboard.writeText(editorContents[file.name] || file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const file = activeFilePath ? fileByPath[activeFilePath] : undefined;
    if (!file) return;
    const content = editorContents[file.name] || file.content;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const currentFile = activeFilePath ? fileByPath[activeFilePath] : undefined;
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const openFile = (path: string) => {
    if (!fileByPath[path]) return;
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFilePath(path);
    getParentFolders(path).forEach((folderPath) => {
      setExpandedFolders((prev) => ({ ...prev, [folderPath]: true }));
    });
  };

  const closeFile = (path: string) => {
    setOpenFiles((prev) => {
      const index = prev.indexOf(path);
      if (index === -1) return prev;
      const next = prev.filter((openPath) => openPath !== path);
      setActiveFilePath((current) => {
        if (current !== path) return current;
        if (next.length === 0) return null;
        return next[Math.max(0, index - 1)] ?? next[0];
      });
      return next;
    });
  };

  const renderTree = (nodes: TreeNode[], depth = 0): JSX.Element[] =>
    nodes.map((node) => {
      const paddingLeft = 10 + depth * 14;
      if (node.type === "folder") {
        const isOpen = Boolean(expandedFolders[node.path]);
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleFolder(node.path)}
              className="w-full flex items-center gap-1.5 py-1.5 pr-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
              style={{ paddingLeft }}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              {isOpen ? (
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {isOpen && node.children ? renderTree(node.children, depth + 1) : null}
          </div>
        );
      }

      const isActive = activeFilePath === node.path;
      return (
        <button
          key={node.path}
          onClick={() => openFile(node.path)}
          className={`w-full flex items-center gap-1.5 py-1.5 pr-2 text-xs text-left transition-colors ${
            isActive
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
          style={{ paddingLeft }}
        >
          <File className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

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
              onClick={handleDownload}
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
            {onPushToGitHub && (
              <button
                onClick={onPushToGitHub}
                className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
                title="Push to GitHub"
              >
                <GitBranch className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {files.length > 0 ? (
          <div className="h-full flex">
            <aside className="w-56 border-r border-border bg-surface/20 overflow-y-auto">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] tracking-wider uppercase text-muted-foreground font-semibold">
                  Explorer
                </p>
              </div>
              <div className="py-1">{renderTree(fileTree)}</div>
            </aside>
            <div className="flex-1 overflow-hidden flex flex-col">
              {openFiles.length > 0 && (
                <div className="h-9 border-b border-border flex items-center overflow-x-auto">
                  {openFiles.map((path) => {
                    const isActive = path === activeFilePath;
                    const tabName = path.split("/").at(-1) || path;
                    return (
                      <button
                        key={path}
                        onClick={() => setActiveFilePath(path)}
                        title={path}
                        className={`group h-full px-3 flex items-center gap-2 text-xs border-r border-border whitespace-nowrap ${
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                        }`}
                      >
                        <span className="max-w-40 truncate">{tabName}</span>
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            closeFile(path);
                          }}
                          className="p-0.5 rounded hover:bg-black/20"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
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
                  <div className="h-full flex items-center justify-center text-center">
                    <p className="text-sm text-muted-foreground">Open a file from Explorer</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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

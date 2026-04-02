import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { chatWithProject } from "@/lib/projectChat";
import { cn } from "@/lib/utils";
import type { CodeFile } from "./CodePanel";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** For assistant: show as steps (e.g. processing progress) */
  steps?: string[];
}

const CHAT_STORAGE_KEY = "figma-to-code-chat-";

function loadChatMessages(projectId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_KEY}${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChatMessages(projectId: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${CHAT_STORAGE_KEY}${projectId}`, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ChatPanelProps {
  files: CodeFile[];
  componentName: string | null;
  projectId: string;
  onApplyEdits: (updates: Record<string, string>) => void;
  onHistoryEntry?: (type: "ai_edit", description: string, filesSnapshot: CodeFile[]) => void;
}

const ChatPanel = ({
  files,
  componentName,
  projectId,
  onApplyEdits,
  onHistoryEntry,
}: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatMessages(projectId));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadChatMessages(projectId));
  }, [projectId]);

  useEffect(() => {
    saveChatMessages(projectId, messages);
  }, [projectId, messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setError(null);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Show step-by-step progress like Cursor/Lovable
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    const steps = [
      { delay: 0, text: "Analyzing your request..." },
      { delay: 400, text: "Identifying files to modify..." },
      { delay: 900, text: "Sending to AI model..." },
      { delay: 1400, text: "Generating code changes..." },
      { delay: 2000, text: "Processing response..." },
    ];
    steps.forEach(({ delay, text }) => {
      const t = setTimeout(() => {
        setProcessingSteps((prev) => (prev.includes(text) ? prev : [...prev, text]));
      }, delay);
      stepTimers.push(t);
    });

    try {
      const result = await chatWithProject(
        text,
        files.map((f) => ({ name: f.name, content: f.content })),
        componentName
      );

      // Build a detailed response showing what was done
      const filesChanged = Object.keys(result.fileUpdates);
      let content = result.message;
      if (filesChanged.length > 0) {
        content += `\n\n**Files modified:**\n${filesChanged.map((f) => `• ${f}`).join("\n")}`;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (filesChanged.length > 0) {
        onApplyEdits(result.fileUpdates);
        const merged = files.map((f) => (f.name in result.fileUpdates ? { ...f, content: result.fileUpdates[f.name] } : f));
        const newNames = filesChanged.filter((n) => !files.some((f) => f.name === n));
        newNames.forEach((n) => merged.push({ name: n, content: result.fileUpdates[n], language: "typescript" }));
        onHistoryEntry?.("ai_edit", `${filesChanged.join(", ")}: ${result.message.slice(0, 80)}...`, merged);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      setError(errMsg);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `**Error:** ${errMsg}\n\nMake sure your DeepSeek API key is set in Profile/Settings.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      stepTimers.forEach((t) => clearTimeout(t));
      setProcessingSteps([]);
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-12 flex items-center gap-2 px-4 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Project Chat</span>
      </div>
      {/* Scrollable chat area - WhatsApp style */}
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0 bg-muted/20">
        <div className="p-3 space-y-2 flex flex-col">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <p>Describe changes you want to make</p>
              <p className="mt-1 opacity-80">e.g. &quot;Add a loading state to the button&quot;</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap break-words">
                  {m.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={i}>{part.slice(2, -2)}</strong>
                    ) : (
                      part
                    )
                  )}
                </p>
                <p className={cn("text-[10px] mt-1", m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {formatTime(m.timestamp)}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm bg-card border border-border max-w-[90%]">
                <div className="flex items-start gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground">Processing your request...</p>
                    {processingSteps.length > 0 && (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {processingSteps.map((step, i) => (
                          <li key={step} className="flex items-center gap-2">
                            <span className="text-primary">✓</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
          {error}
        </div>
      )}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Describe your changes..."
            className="flex-1 bg-muted border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;

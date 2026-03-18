import { useState, useRef, useCallback } from "react";
import {
  X,
  Sparkles,
  Loader2,
  ChevronDown,
  Type,
  Palette,
  Maximize,
  Square,
  Move,
  Layout,
  AlertCircle,
} from "lucide-react";
import { SelectedElement } from "@/hooks/useVisualEdit";

interface VisualEditPanelProps {
  element: SelectedElement;
  componentCode: string;
  onStyleChange: (prop: string, value: string) => void;
  onTextChange: (text: string) => void;
  onAIEdit: (prompt: string) => Promise<void>;
  onClose: () => void;
  editError?: string | null;
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert computed color (rgb/rgba) → hex for the color input
  const toHex = (color: string): string => {
    if (color.startsWith("#")) return color;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = color;
    return ctx.fillStyle; // browser normalizes to #rrggbb
  };

  const hex = toHex(value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-6 h-6 rounded border border-border shrink-0"
        style={{ backgroundColor: hex }}
        title={hex}
      />
      <input
        ref={inputRef}
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <span className="text-[11px] font-mono text-muted-foreground flex-1 truncate">{hex}</span>
    </div>
  );
}

function Stepper({
  label,
  value,
  unit,
  step = 1,
  min = 0,
  max = 200,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-6 h-6 flex items-center justify-center rounded bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover text-xs leading-none"
      >−</button>
      <span className="text-xs font-mono text-foreground w-12 text-center">
        {value}{unit}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-6 h-6 flex items-center justify-center rounded bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover text-xs leading-none"
      >+</button>
    </div>
  );
}

function RangeSlider({
  label,
  value,
  unit,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-mono text-foreground">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-border accent-primary cursor-pointer"
      />
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const VisualEditPanel = ({
  element,
  componentCode,
  onStyleChange,
  onTextChange,
  onAIEdit,
  onClose,
  editError,
}: VisualEditPanelProps) => {
  const cs = element.computedStyles;
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState(element.textContent || "");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    text: true,
    colors: true,
    typography: true,
    spacing: false,
    border: true,
    layout: false,
    ai: true,
  });

  const parseFloat2 = (v: string) => parseFloat(v) || 0;

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const Section = useCallback(
    ({ id, icon, label, children }: { id: string; icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) => (
      <div className="border-b border-border/50 pb-3">
        <button
          onClick={() => toggleSection(id)}
          className="flex items-center justify-between w-full mb-2"
        >
          <SectionHeader icon={icon} label={label} />
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${openSections[id] ? "rotate-180" : ""}`}
          />
        </button>
        {openSections[id] && <div className="space-y-2">{children}</div>}
      </div>
    ),
    [openSections]
  );

  const handleAIApply = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      await onAIEdit(aiPrompt.trim());
      setAiPrompt("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI edit failed.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // ─── Breadcrumb path from selector ──
  const selectorParts = element.selector.split(" > ").slice(-3);
  const breadcrumb = selectorParts.join(" › ");

  return (
    <div
      className="w-72 h-full flex flex-col bg-card border-l border-border overflow-hidden"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary text-[10px] font-bold">✏</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground leading-none">Visual Edit</p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[170px] mt-0.5" title={element.selector}>
              {breadcrumb}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Element badge */}
      <div className="px-3 py-2 bg-surface/30 border-b border-border/50 flex items-center gap-2 shrink-0">
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-semibold">
          &lt;{element.tagName}&gt;
        </span>
        {element.className && (
          <span className="text-[10px] text-muted-foreground truncate flex-1" title={element.className}>
            .{element.className.split(" ").slice(0, 2).join(".")}
          </span>
        )}
      </div>

      {/* Error display */}
      {editError && (
        <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive">{editError}</p>
        </div>
      )}

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

        {/* TEXT CONTENT */}
        {element.textContent && element.textContent.trim().length > 0 && (
          <Section id="text" icon={Type} label="Text Content">
            <div className="flex gap-2">
              <input
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Edit text..."
              />
              <button
                onClick={() => onTextChange(textContent)}
                className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              >
                Apply
              </button>
            </div>
          </Section>
        )}

        {/* COLORS */}
        <Section id="colors" icon={Palette} label="Colors">
          <ColorSwatch
            label="Background"
            value={cs.backgroundColor || "transparent"}
            onChange={(v) => onStyleChange("backgroundColor", v)}
          />
          <ColorSwatch
            label="Text"
            value={cs.color || "#000000"}
            onChange={(v) => onStyleChange("color", v)}
          />
          <ColorSwatch
            label="Border"
            value={cs.borderColor || "transparent"}
            onChange={(v) => onStyleChange("borderColor", v)}
          />
        </Section>

        {/* TYPOGRAPHY */}
        <Section id="typography" icon={Type} label="Typography">
          <Stepper
            label="Font Size"
            value={parseFloat2(cs.fontSize)}
            unit="px"
            step={1}
            min={8}
            max={96}
            onChange={(v) => onStyleChange("fontSize", `${v}px`)}
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0">Weight</span>
            <div className="flex gap-1 flex-wrap">
              {([400, 500, 600, 700, 900] as const).map((w) => {
                const current = parseFloat2(cs.fontWeight);
                return (
                  <button
                    key={w}
                    onClick={() => onStyleChange("fontWeight", String(w))}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      Math.abs(current - w) < 50
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    }`}
                    style={{ fontWeight: w }}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* SPACING */}
        <Section id="spacing" icon={Move} label="Spacing">
          <Stepper
            label="Padding"
            value={parseFloat2(cs.paddingTop)}
            unit="px"
            step={2}
            max={100}
            onChange={(v) => {
              onStyleChange("paddingTop", `${v}px`);
              onStyleChange("paddingRight", `${v}px`);
              onStyleChange("paddingBottom", `${v}px`);
              onStyleChange("paddingLeft", `${v}px`);
            }}
          />
          <Stepper
            label="Margin"
            value={parseFloat2(cs.marginTop)}
            unit="px"
            step={2}
            min={0}
            max={100}
            onChange={(v) => {
              onStyleChange("marginTop", `${v}px`);
              onStyleChange("marginRight", `${v}px`);
              onStyleChange("marginBottom", `${v}px`);
              onStyleChange("marginLeft", `${v}px`);
            }}
          />
        </Section>

        {/* BORDER */}
        <Section id="border" icon={Square} label="Border & Shape">
          <RangeSlider
            label="Border Radius"
            value={parseFloat2(cs.borderRadius)}
            unit="px"
            min={0}
            max={64}
            step={1}
            onChange={(v) => onStyleChange("borderRadius", `${v}px`)}
          />
          <RangeSlider
            label="Opacity"
            value={Math.round(parseFloat2(cs.opacity || "1") * 100)}
            unit="%"
            min={0}
            max={100}
            step={5}
            onChange={(v) => onStyleChange("opacity", String(v / 100))}
          />
        </Section>

        {/* LAYOUT */}
        <Section id="layout" icon={Layout} label="Layout">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0">Display</span>
            <div className="flex gap-1 flex-wrap">
              {["block", "flex", "grid", "inline"].map((d) => (
                <button
                  key={d}
                  onClick={() => onStyleChange("display", d)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    cs.display === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {cs.display === "flex" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-20 shrink-0">Direction</span>
                <div className="flex gap-1">
                  {["row", "column"].map((d) => (
                    <button
                      key={d}
                      onClick={() => onStyleChange("flexDirection", d)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        cs.flexDirection === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </Section>

        {/* AI EDIT */}
        <Section id="ai" icon={Sparkles} label="AI Edit">
          {aiError && (
            <div className="px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-[11px] text-destructive">{aiError}</p>
            </div>
          )}
          <div className="space-y-2">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAIApply();
              }}
              placeholder='e.g. "Make this button pill-shaped and blue" or "Add a hover shadow effect"'
              rows={3}
              className="w-full bg-muted border border-border rounded-lg px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <button
              onClick={handleAIApply}
              disabled={!aiPrompt.trim() || isAiLoading}
              className="w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-primary to-violet-500 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Applying AI Edit…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Apply AI Edit
                  <span className="text-[10px] opacity-60 ml-1">⌘↵</span>
                </>
              )}
            </button>
          </div>
        </Section>
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <p className="text-[10px] text-muted-foreground text-center">
          Changes sync to code editor instantly
        </p>
      </div>
    </div>
  );
};

export default VisualEditPanel;

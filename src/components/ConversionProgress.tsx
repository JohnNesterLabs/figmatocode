import { Check, Loader2, AlertTriangle, X } from "lucide-react";

export interface ConversionStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "warning" | "error";
  detail?: string;
}

interface ConversionProgressProps {
  steps: ConversionStep[];
}

const statusIcon = (status: ConversionStep["status"]) => {
  switch (status) {
    case "done":
      return <Check className="w-3.5 h-3.5 text-success" />;
    case "active":
      return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case "warning":
      return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
    case "error":
      return <X className="w-3.5 h-3.5 text-destructive" />;
    default:
      return <div className="w-3.5 h-3.5 rounded-full border border-border" />;
  }
};

const ConversionProgress = ({ steps }: ConversionProgressProps) => {
  return (
    <div className="space-y-1 p-3">
      {steps.map((step, i) => (
        <div
          key={step.id}
          className="flex items-start gap-3 py-1.5 animate-fade-in"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="mt-0.5 flex-shrink-0">{statusIcon(step.status)}</div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-medium ${
                step.status === "active"
                  ? "text-foreground"
                  : step.status === "done"
                  ? "text-muted-foreground"
                  : step.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground/50"
              }`}
            >
              {step.label}
            </p>
            {step.detail && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{step.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversionProgress;

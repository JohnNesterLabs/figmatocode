interface FrameworkChipsProps {
  selected: string[];
  onChange: (frameworks: string[]) => void;
}

const frameworks = [
  { id: "react", label: "React", color: "hsl(var(--primary))" },
  { id: "vue", label: "Vue", color: "hsl(142 71% 45%)" },
  { id: "svelte", label: "Svelte", color: "hsl(15 100% 50%)" },
  { id: "angular", label: "Angular", color: "hsl(358 86% 57%)" },
  { id: "solid", label: "Solid", color: "hsl(210 100% 50%)" },
];

const FrameworkChips = ({ selected, onChange }: FrameworkChipsProps) => {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((f) => f !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {frameworks.map((fw) => {
        const isSelected = selected.includes(fw.id);
        return (
          <button
            key={fw.id}
            onClick={() => toggle(fw.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${
              isSelected
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {fw.label}
          </button>
        );
      })}
    </div>
  );
};

export default FrameworkChips;

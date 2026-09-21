"use client";

interface ViewToggleProps {
  layout: "grid" | "list";
  onChange: (layout: "grid" | "list") => void;
}

export function ViewToggle({ layout, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1" aria-label="Weergave">
      <button
        aria-label="Rasterweergave"
        aria-pressed={layout === "grid"}
        className={`h-9 w-9 border text-sm ${layout === "grid" ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 text-stone-500"}`}
        onClick={() => onChange("grid")}
        type="button"
      >
        ▦
      </button>
      <button
        aria-label="Lijstweergave"
        aria-pressed={layout === "list"}
        className={`h-9 w-9 border text-sm ${layout === "list" ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 text-stone-500"}`}
        onClick={() => onChange("list")}
        type="button"
      >
        ≡
      </button>
    </div>
  );
}

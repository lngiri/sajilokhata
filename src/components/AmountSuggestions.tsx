"use client";

interface Props {
  onSelect: (amount: number) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [10, 50, 100, 500];

export default function AmountSuggestions({ onSelect, disabled }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {SUGGESTIONS.map((val) => (
        <button
          key={val}
          type="button"
          onClick={() => onSelect(val)}
          disabled={disabled}
          className="flex-shrink-0 px-4 py-2 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl text-sm font-medium text-[var(--color-primary)] active:scale-95 transition-transform disabled:opacity-50"
        >
          +Rs. {val}
        </button>
      ))}
    </div>
  );
}

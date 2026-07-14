"use client";

interface DescriptionSuggestionsProps {
  descriptions: string[];
  onSelect: (description: string) => void;
}

export default function DescriptionSuggestions({ descriptions, onSelect }: DescriptionSuggestionsProps) {
  if (descriptions.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Recent descriptions:</p>
      <div className="flex flex-wrap gap-1.5">
        {descriptions.slice(0, 4).map((desc, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(desc)}
            className="px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-full border border-gray-200 active:scale-95 transition-transform hover:bg-gray-100"
          >
            {desc}
          </button>
        ))}
      </div>
    </div>
  );
}

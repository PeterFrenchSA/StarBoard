"use client";

interface AvatarPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const AVATAR_CHOICES = ["⭐", "🌟", "🚀", "🦁", "🐼", "🦄", "🐯", "🐬"];

export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-board-ink">Avatar</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {AVATAR_CHOICES.map((emoji) => {
          const selected = emoji === value;
          return (
            <button
              key={emoji}
              type="button"
              className={`flex h-11 items-center justify-center rounded-xl border text-xl transition ${
                selected
                  ? "border-board-mint bg-board-mint/10 shadow-[0_0_0_2px_rgba(41,199,184,0.18)]"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              onClick={() => onChange(emoji)}
              aria-label={`Choose avatar ${emoji}`}
              aria-pressed={selected}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}

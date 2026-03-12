"use client";

interface RewardEmojiPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const REWARD_EMOJI_CHOICES = [
  "🎁",
  "🏆",
  "🎮",
  "🎬",
  "🍕",
  "🍦",
  "🧸",
  "🚴",
  "📚",
  "🛴",
  "🎨",
  "⚽",
  "🏀",
  "🎯",
  "🎡",
  "🏕️",
  "🎵",
  "🎂",
  "🧁",
  "🧩",
  "🐶",
  "🦄",
  "🌈",
  "⭐"
];

export function RewardEmojiPicker({ value, onChange, className }: RewardEmojiPickerProps) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-board-ink">Reward Badge Emoji</p>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
        {REWARD_EMOJI_CHOICES.map((emoji) => {
          const selected = emoji === value;
          return (
            <button
              key={emoji}
              type="button"
              className={`flex h-10 items-center justify-center rounded-xl border text-lg transition ${
                selected
                  ? "border-board-sun bg-board-sun/20 shadow-[0_0_0_2px_rgba(255,198,66,0.2)]"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              onClick={() => onChange(emoji)}
              aria-label={`Choose reward emoji ${emoji}`}
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

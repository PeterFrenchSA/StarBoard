export const CHILD_THEME_VALUES = ["fairies", "dragons", "ninjas", "engineering"] as const;

export type ChildThemeValue = (typeof CHILD_THEME_VALUES)[number];

interface ChildThemeDefinition {
  value: ChildThemeValue;
  label: string;
  accentEmoji: string;
  taskEmoji: string;
  rewardEmoji: string;
  badgeEmoji: string;
  backgroundStart: string;
  backgroundEnd: string;
  backgroundAccent: string;
  borderColor: string;
  glowColor: string;
  primaryButton: string;
  primaryButtonHover: string;
  secondaryButton: string;
  secondaryButtonHover: string;
  headingColor: string;
}

const CHILD_THEME_DEFINITIONS: Record<ChildThemeValue, ChildThemeDefinition> = {
  fairies: {
    value: "fairies",
    label: "Fairies",
    accentEmoji: "🧚",
    taskEmoji: "🪄",
    rewardEmoji: "✨",
    badgeEmoji: "🌸",
    backgroundStart: "#fff5ff",
    backgroundEnd: "#f3f0ff",
    backgroundAccent: "rgba(244, 114, 182, 0.18)",
    borderColor: "rgba(236, 72, 153, 0.32)",
    glowColor: "rgba(236, 72, 153, 0.18)",
    primaryButton: "#db2777",
    primaryButtonHover: "#be185d",
    secondaryButton: "#f59e0b",
    secondaryButtonHover: "#d97706",
    headingColor: "#831843"
  },
  dragons: {
    value: "dragons",
    label: "Dragons",
    accentEmoji: "🐉",
    taskEmoji: "🔥",
    rewardEmoji: "🛡️",
    badgeEmoji: "🏆",
    backgroundStart: "#fff7ed",
    backgroundEnd: "#fee2e2",
    backgroundAccent: "rgba(251, 146, 60, 0.22)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    glowColor: "rgba(234, 88, 12, 0.2)",
    primaryButton: "#dc2626",
    primaryButtonHover: "#b91c1c",
    secondaryButton: "#f97316",
    secondaryButtonHover: "#ea580c",
    headingColor: "#7f1d1d"
  },
  ninjas: {
    value: "ninjas",
    label: "Ninjas",
    accentEmoji: "🥷",
    taskEmoji: "⚔️",
    rewardEmoji: "🎯",
    badgeEmoji: "🌙",
    backgroundStart: "#f8fafc",
    backgroundEnd: "#e2e8f0",
    backgroundAccent: "rgba(71, 85, 105, 0.18)",
    borderColor: "rgba(51, 65, 85, 0.32)",
    glowColor: "rgba(30, 41, 59, 0.18)",
    primaryButton: "#334155",
    primaryButtonHover: "#1e293b",
    secondaryButton: "#0f766e",
    secondaryButtonHover: "#115e59",
    headingColor: "#0f172a"
  },
  engineering: {
    value: "engineering",
    label: "Engineering",
    accentEmoji: "🛠️",
    taskEmoji: "⚙️",
    rewardEmoji: "🔧",
    badgeEmoji: "🧠",
    backgroundStart: "#eff6ff",
    backgroundEnd: "#ecfeff",
    backgroundAccent: "rgba(59, 130, 246, 0.18)",
    borderColor: "rgba(59, 130, 246, 0.28)",
    glowColor: "rgba(14, 165, 233, 0.2)",
    primaryButton: "#2563eb",
    primaryButtonHover: "#1d4ed8",
    secondaryButton: "#0ea5e9",
    secondaryButtonHover: "#0284c7",
    headingColor: "#1e3a8a"
  }
};

const LEGACY_THEME_MAP: Record<string, ChildThemeValue> = {
  sun: "fairies",
  mint: "fairies",
  coral: "dragons",
  sky: "engineering"
};

export const DEFAULT_CHILD_THEME: ChildThemeValue = "fairies";

export const CHILD_THEME_OPTIONS = CHILD_THEME_VALUES.map((value) => CHILD_THEME_DEFINITIONS[value]);

export function isChildThemeValue(value: string): value is ChildThemeValue {
  return CHILD_THEME_VALUES.includes(value as ChildThemeValue);
}

export function normalizeChildTheme(rawTheme: string | null | undefined): ChildThemeValue {
  if (!rawTheme) {
    return DEFAULT_CHILD_THEME;
  }

  const normalized = rawTheme.trim().toLowerCase();
  if (isChildThemeValue(normalized)) {
    return normalized;
  }

  return LEGACY_THEME_MAP[normalized] ?? DEFAULT_CHILD_THEME;
}

export function getChildTheme(rawTheme: string | null | undefined): ChildThemeDefinition {
  const normalized = normalizeChildTheme(rawTheme);
  return CHILD_THEME_DEFINITIONS[normalized];
}

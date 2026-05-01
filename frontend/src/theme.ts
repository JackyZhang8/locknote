import { create } from 'zustand';

export type ThemeId = 'apple' | 'lobster' | 'sunset';

export interface ThemeOption {
  id: ThemeId;
  nameKey: 'themeApple' | 'themeLobster' | 'themeSunset';
  swatch: string;
}

type ThemeReader = {
  getItem: (key: string) => string | null;
} | null | undefined;

type ThemeWriter = {
  setItem: (key: string, value: string) => void;
} | null | undefined;

type ThemeDocument = {
  documentElement: {
    dataset: {
      theme?: string;
    };
  };
} | null | undefined;

export const THEME_STORAGE_KEY = 'locknote-theme';

export const themeOptions: ThemeOption[] = [
  { id: 'apple', nameKey: 'themeApple', swatch: '#22c55e' },
  { id: 'lobster', nameKey: 'themeLobster', swatch: '#e04747' },
  { id: 'sunset', nameKey: 'themeSunset', swatch: '#f86a3b' },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'apple' || value === 'lobster' || value === 'sunset';
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function getStoredTheme(storage: ThemeReader = getBrowserStorage()): ThemeId {
  try {
    const savedTheme = storage?.getItem(THEME_STORAGE_KEY);
    return isThemeId(savedTheme) ? savedTheme : 'apple';
  } catch {
    return 'apple';
  }
}

export function applyTheme(
  theme: ThemeId,
  doc: ThemeDocument = typeof document !== 'undefined' ? document : undefined,
  storage: ThemeWriter = getBrowserStorage(),
): void {
  if (doc) {
    doc.documentElement.dataset.theme = theme;
  }

  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage write failures and keep the in-memory theme applied.
  }
}

const initialTheme = getStoredTheme();

if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = initialTheme;
}

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));

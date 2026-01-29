import { create } from 'zustand';
import { zhCN, type Translations } from './locales/zh-CN';
import { enUS } from './locales/en-US';

export type Language = 'zh-CN' | 'en-US';

const locales: Record<Language, Translations> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const STORAGE_KEY = 'locknote-language';

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en-US') {
      return saved;
    }
  } catch {
    // localStorage not available
  }
  return 'zh-CN';
}

const initialLanguage = getInitialLanguage();
document.documentElement.lang = initialLanguage;

interface I18nState {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
}

export const useI18n = create<I18nState>((set) => ({
  language: initialLanguage,
  t: locales[initialLanguage],
  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage not available
    }
    document.documentElement.lang = lang;
    set({ language: lang, t: locales[lang] });
  },
}));

// 辅助函数：替换模板字符串中的变量
export function formatMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

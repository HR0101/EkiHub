"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_LOCALE,
  readStoredLocale,
  storeLocale,
  translate,
  type Locale,
  type MessageKey,
  type MessageValues,
} from "@/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * 表示言語を配る。
 *
 * 初期値は必ず既定（日本語）にしておき、保存済みの言語はマウント後に当てる。
 * サーバーとクライアントで初回の描画を一致させるため
 * （localStorage はサーバーで読めないので、ここで読むとハイドレーションが崩れる）。
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    // localStorage はサーバーで読めない。初回描画を一致させるため、
    // 保存済みの言語はマウント後に当てる（意図的な setState）
    const stored = readStoredLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== DEFAULT_LOCALE) setLocaleState(stored);
  }, []);

  // <html lang> を実際の表示言語に合わせる（読み上げと検索エンジンのため）
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/** 文言を引くフック。Provider の外で呼ぶと例外になる */
export function useTranslation(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useTranslation は LocaleProvider の内側で使ってください");
  }
  return context;
}

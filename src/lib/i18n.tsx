"use client";

// In-house i18n: a locale context + t() with {var} interpolation. No routing,
// no external dependency — see messages.ts for the dictionaries. The chosen
// locale is persisted, mirrored onto <html lang>, and sent to the backend via
// the axios Accept-Language header so server-generated text is localized too.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "./api";
import { en, it } from "./messages";

export type Locale = "it" | "en";
const DICTS: Record<Locale, Record<string, string>> = { it, en };
const STORAGE_KEY = "locale";
const DEFAULT_LOCALE: Locale = "it";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

function applySideEffects(l: Locale) {
  if (typeof document !== "undefined") document.documentElement.lang = l;
  api.defaults.headers.common["Accept-Language"] = l;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Always start from the default so server and first client render match;
  // the stored choice is applied right after mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let saved: Locale = DEFAULT_LOCALE;
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "it" || s === "en") saved = s;
    } catch {
      /* ignore */
    }
    setLocaleState(saved);
    applySideEffects(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    applySideEffects(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[locale]?.[key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return s;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n(): Ctx {
  const c = useContext(LocaleContext);
  if (!c) throw new Error("useI18n must be used within <LocaleProvider>");
  return c;
}

export function useT() {
  return useI18n().t;
}

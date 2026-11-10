import { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t as lookup } from "../i18n/translations.js";

const STORAGE_KEY = "@gizego/locale";

const LocaleContext = createContext({
  locale: /** @type {"en"|"am"} */ ("en"),
  setLocale: async (_locale) => {},
  t: (key, vars) => lookup("en", key, vars),
  toggleLocale: () => {},
});

/**
 * English + Amharic (አማርኛ). UI strings are bundled; optionally use `translateWithGoogle` API for extra text.
 */
export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(/** @type {"en"|"am"} */ ("en"));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "am" || stored === "en") setLocaleState(stored);
    });
  }, []);

  const setLocale = useCallback(async (next) => {
    const v = next === "am" || next === "en" ? next : "en";
    setLocaleState(v);
    await AsyncStorage.setItem(STORAGE_KEY, v);
  }, []);

  const toggleLocale = useCallback(() => {
    const next = locale === "am" ? "en" : "am";
    void setLocale(next);
  }, [locale, setLocale]);

  const t = useMemo(
    () => (key, vars) => lookup(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, toggleLocale }),
    [locale, setLocale, t, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

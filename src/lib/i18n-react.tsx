import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import {
  getDefaultLocale,
  getStoredLocale,
  persistLocale,
  supportedLocales,
  translate,
  type Locale,
  type TranslationParams,
} from './i18n'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: TranslationParams, fallback?: string) => string
  supportedLocales: typeof supportedLocales
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale())

  useEffect(() => {
    persistLocale(locale)
  }, [locale])

  function changeLocale(nextLocale: Locale) {
    setLocaleState(nextLocale)
    persistLocale(nextLocale)
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: changeLocale,
      t: (key, params, fallback) => translate(locale, key, params, fallback),
      supportedLocales,
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    return {
      locale: getDefaultLocale(),
      setLocale: () => undefined,
      t: (key: string, params?: TranslationParams, fallback?: string) => translate(getDefaultLocale(), key, params, fallback),
      supportedLocales,
    } satisfies I18nContextValue
  }
  return context
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { LanguageCode } from "@/lib/gig/models";

const STORAGE_KEY = "cgs.language";
const listeners = new Set<() => void>();
let globalLanguage: LanguageCode = "en";
const translations: Record<LanguageCode, Record<string, string>> = { en: {}, te: {}, hi: {} };
function notify() { listeners.forEach((listener) => listener()); }
function getGlobalLanguage() { return globalLanguage; }
function subscribeToGlobalLanguage(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function setGlobalLanguage(language: LanguageCode) { globalLanguage = language; void AsyncStorage.setItem(STORAGE_KEY, language); notify(); }

type I18nValue = { language: LanguageCode; setLanguage: (language: LanguageCode) => void; t: (key: string, fallback?: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeToGlobalLanguage, getGlobalLanguage, getGlobalLanguage);
  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (value === "en" || value === "te" || value === "hi") { globalLanguage = value; notify(); } }); }, []);
  const value = useMemo<I18nValue>(() => ({ language, setLanguage: setGlobalLanguage, t: (key, fallback) => translations[language][key] || fallback || key }), [language]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() { const context = useContext(I18nContext); if (!context) throw new Error("useI18n must be used inside I18nProvider"); return context; }

export function GlobalLanguagePicker() {
  const { language, setLanguage } = useI18n();
  return React.createElement(View, { style: { flexDirection: "row", gap: 8 } }, React.createElement(Text, { style: { fontWeight: "700" } }, "Language"), ...(["en", "te", "hi"] as LanguageCode[]).map((item) => React.createElement(Pressable, { key: item, onPress: () => setLanguage(item) }, React.createElement(Text, { style: { fontWeight: language === item ? "800" : "400" } }, item.toUpperCase()))));
}

export function LocalizedText({ children, translationKey, ...props }: React.ComponentProps<typeof Text> & { translationKey?: string }) {
  const { t } = useI18n();
  const value = typeof children === "string" && translationKey ? t(translationKey, children) : children;
  return React.createElement(Text, props, value);
}

export function LocalizedTextInput({ placeholder, ...props }: React.ComponentProps<typeof TextInput>) { return React.createElement(TextInput, { ...props, placeholder }); }

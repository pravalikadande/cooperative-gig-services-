import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { LanguageCode } from "@/lib/gig/models";

const STORAGE_KEY = "cgs.language";
const listeners = new Set<() => void>();
let globalLanguage: LanguageCode = "en";
const languageNames: Record<LanguageCode, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी", mr: "मराठी", ta: "தமிழ்", bn: "বাংলা" };
const dictionary: Record<LanguageCode, Record<string, string>> = {
  en: {},
  te: { "Sign in": "సైన్ ఇన్", "Create account": "ఖాతా సృష్టించండి", "Continue with Google": "Googleతో కొనసాగండి", "Welcome back": "తిరిగి స్వాగతం", "Email address": "ఈమెయిల్ చిరునామా", "Password": "పాస్‌వర్డ్", "Book service": "సేవను బుక్ చేయండి", "Confirm booking": "బుకింగ్ నిర్ధారించండి", "Submit review": "రివ్యూ పంపండి", "Payment method": "చెల్లింపు విధానం", "Cash on Service": "సేవ సమయంలో నగదు", "My bookings": "నా బుకింగ్‌లు", "Profile": "ప్రొఫైల్", "Home": "హోమ్", "Explore": "వెతకండి" },
  hi: { "Sign in": "साइन इन", "Create account": "खाता बनाएं", "Continue with Google": "Google से जारी रखें", "Welcome back": "वापसी पर स्वागत है", "Email address": "ईमेल पता", "Password": "पासवर्ड", "Book service": "सेवा बुक करें", "Confirm booking": "बुकिंग की पुष्टि करें", "Submit review": "समीक्षा भेजें", "Payment method": "भुगतान का तरीका", "Cash on Service": "सेवा पर नकद", "My bookings": "मेरी बुकिंग", "Profile": "प्रोफ़ाइल", "Home": "होम", "Explore": "खोजें" },
  mr: { "Sign in": "साइन इन", "Create account": "खाते तयार करा", "Continue with Google": "Google सह सुरू ठेवा", "Welcome back": "पुन्हा स्वागत आहे", "Email address": "ईमेल पत्ता", "Password": "पासवर्ड", "Book service": "सेवा बुक करा", "Confirm booking": "बुकिंग निश्चित करा", "Submit review": "अभिप्राय पाठवा", "Payment method": "पेमेंट पद्धत", "Cash on Service": "सेवावेळी रोख", "My bookings": "माझ्या बुकिंग", "Profile": "प्रोफाइल", "Home": "होम", "Explore": "शोधा" },
  ta: { "Sign in": "உள்நுழைக", "Create account": "கணக்கை உருவாக்கு", "Continue with Google": "Google மூலம் தொடர்க", "Welcome back": "மீண்டும் வரவேற்கிறோம்", "Email address": "மின்னஞ்சல்", "Password": "கடவுச்சொல்", "Book service": "சேவையை முன்பதிவு செய்க", "Confirm booking": "முன்பதிவை உறுதிசெய்க", "Submit review": "மதிப்பாய்வை அனுப்புக", "Payment method": "கட்டண முறை", "Cash on Service": "சேவையின் போது பணம்", "My bookings": "எனது முன்பதிவுகள்", "Profile": "சுயவிவரம்", "Home": "முகப்பு", "Explore": "ஆராய்க" },
  bn: { "Sign in": "সাইন ইন", "Create account": "অ্যাকাউন্ট তৈরি করুন", "Continue with Google": "Google দিয়ে চালিয়ে যান", "Welcome back": "আবার স্বাগতম", "Email address": "ইমেল ঠিকানা", "Password": "পাসওয়ার্ড", "Book service": "পরিষেবা বুক করুন", "Confirm booking": "বুকিং নিশ্চিত করুন", "Submit review": "রিভিউ পাঠান", "Payment method": "পেমেন্ট পদ্ধতি", "Cash on Service": "পরিষেবার সময় নগদ", "My bookings": "আমার বুকিং", "Profile": "প্রোফাইল", "Home": "হোম", "Explore": "অন্বেষণ" },
};
function notify() { listeners.forEach((listener) => listener()); }
function getGlobalLanguage() { return globalLanguage; }
function subscribeToGlobalLanguage(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function setGlobalLanguage(language: LanguageCode) { globalLanguage = language; void AsyncStorage.setItem(STORAGE_KEY, language); notify(); }

type I18nValue = { language: LanguageCode; setLanguage: (language: LanguageCode) => void; t: (key: string, fallback?: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeToGlobalLanguage, getGlobalLanguage, getGlobalLanguage);
  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (value && value in languageNames) { globalLanguage = value as LanguageCode; notify(); } }); }, []);
  const value = useMemo<I18nValue>(() => ({ language, setLanguage: setGlobalLanguage, t: (key, fallback) => dictionary[language][key] || fallback || key }), [language]);
  return React.createElement(I18nContext.Provider, { value }, children);
}
export function useI18n() { const context = useContext(I18nContext); if (!context) throw new Error("useI18n must be used inside I18nProvider"); return context; }
export function GlobalLanguagePicker() {
  const { language, setLanguage } = useI18n();
  return React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 8 } }, Object.entries(languageNames).map(([code, name]) => React.createElement(Pressable, { key: code, onPress: () => setLanguage(code as LanguageCode), style: { padding: 6 } }, React.createElement(Text, { style: { fontWeight: language === code ? "800" : "400" } }, name))));
}
export function LocalizedText({ children, translationKey, ...props }: React.ComponentProps<typeof Text> & { translationKey?: string }) {
  const { t } = useI18n();
  const value = typeof children === "string" ? t(translationKey || children, children) : children;
  return React.createElement(Text, props, value);
}
export function LocalizedTextInput({ placeholder, ...props }: React.ComponentProps<typeof TextInput>) { const { t } = useI18n(); return React.createElement(TextInput, { ...props, placeholder: placeholder ? t(placeholder, placeholder) : placeholder }); }

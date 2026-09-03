import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { LanguageCode } from "@/lib/gig/models";
import { phraseTranslations } from "@/lib/phrase-translations";

const STORAGE_KEY = "cgs.language";
const listeners = new Set<() => void>();
let globalLanguage: LanguageCode = "en";
const languageNames: Record<LanguageCode, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी", mr: "मराठी", ta: "தமிழ்", bn: "বাংলা" };
const dictionary: Record<LanguageCode, Record<string, string>> = {
  en: { signIn: "Sign in", createAccount: "Create account", welcomeBack: "Welcome back", continueWithGoogle: "Continue with Google", joinCooperative: "Join the cooperative", forgotPassword: "Forgot password?", newHere: "New here? ", createOne: "Create one", back: "Back", fullName: "Full name", yourName: "Your name", enterPassword: "Enter password", emailAddress: "Email address", password: "Password", language: "Language", selectLanguage: "Select language", addPhoneNumber: "Add phone number", phoneNumberMissingTitle: "Phone number missing", phoneNumberMissingCopy: "Add your phone number so the cooperative can contact you about bookings and service updates.", bookService: "Book service", confirmBooking: "Confirm booking", submitReview: "Submit review", paymentMethod: "Payment method", payNow: "Pay now", cashOnService: "Cash on Service", myBookings: "My bookings", home: "Home", explore: "Explore" },
  te: { "Sign in": "సైన్ ఇన్", "Create account": "ఖాతా సృష్టించండి", "Continue with Google": "Googleతో కొనసాగండి", "Welcome back": "తిరిగి స్వాగతం", "Email address": "ఈమెయిల్ చిరునామా", "Password": "పాస్‌వర్డ్", "Book service": "సేవను బుక్ చేయండి", "Confirm booking": "బుకింగ్ నిర్ధారించండి", "Submit review": "రివ్యూ పంపండి", "Payment method": "చెల్లింపు విధానం", "Cash on Service": "సేవ సమయంలో నగదు", "My bookings": "నా బుకింగ్‌లు", "Profile": "ప్రొఫైల్", "Home": "హోమ్", "Explore": "వెతకండి", signIn: "సైన్ ఇన్", createAccount: "ఖాతా సృష్టించండి", welcomeBack: "తిరిగి స్వాగతం", continueWithGoogle: "Googleతో కొనసాగండి", joinCooperative: "కోఆపరేటివ్‌లో చేరండి", forgotPassword: "పాస్‌వర్డ్ మర్చిపోయారా?", newHere: "ఇక్కడ కొత్తా? ", createOne: "ఖాతా సృష్టించండి", back: "వెనుకకు", fullName: "పూర్తి పేరు", yourName: "మీ పేరు", enterPassword: "పాస్‌వర్డ్ నమోదు చేయండి", emailAddress: "ఈమెయిల్ చిరునామా", password: "పాస్‌వర్డ్", language: "భాష", selectLanguage: "భాషను ఎంచుకోండి", addPhoneNumber: "ఫోన్ నంబర్ జోడించండి", phoneNumberMissingTitle: "ఫోన్ నంబర్ లేదు", phoneNumberMissingCopy: "బుకింగ్‌లు మరియు సేవా సమాచారానికి కోఆపరేటివ్ మిమ్మల్ని సంప్రదించడానికి మీ ఫోన్ నంబర్‌ను జోడించండి.", bookService: "సేవను బుక్ చేయండి", confirmBooking: "బుకింగ్ నిర్ధారించండి", submitReview: "రివ్యూ పంపండి", paymentMethod: "చెల్లింపు విధానం", payNow: "ఇప్పుడు చెల్లించండి", cashOnService: "సేవ సమయంలో నగదు", myBookings: "నా బుకింగ్‌లు", home: "హోమ్", explore: "వెతకండి" },
  hi: { "Sign in": "साइन इन", "Create account": "खाता बनाएं", "Continue with Google": "Google से जारी रखें", "Welcome back": "वापसी पर स्वागत है", "Email address": "ईमेल पता", "Password": "पासवर्ड", "Book service": "सेवा बुक करें", "Confirm booking": "बुकिंग की पुष्टि करें", "Submit review": "समीक्षा भेजें", "Payment method": "भुगतान का तरीका", "Cash on Service": "सेवा पर नकद", "My bookings": "मेरी बुकिंग", "Profile": "प्रोफ़ाइल", "Home": "होम", "Explore": "खोजें", signIn: "साइन इन", createAccount: "खाता बनाएं", welcomeBack: "वापसी पर स्वागत है", continueWithGoogle: "Google से जारी रखें", joinCooperative: "सहकारी संस्था से जुड़ें", forgotPassword: "पासवर्ड भूल गए?", newHere: "नए हैं? ", createOne: "खाता बनाएं", back: "वापस", fullName: "पूरा नाम", yourName: "आपका नाम", enterPassword: "पासवर्ड दर्ज करें", emailAddress: "ईमेल पता", password: "पासवर्ड", language: "भाषा", selectLanguage: "भाषा चुनें", addPhoneNumber: "फोन नंबर जोड़ें", phoneNumberMissingTitle: "फोन नंबर नहीं है", phoneNumberMissingCopy: "बुकिंग और सेवा अपडेट के लिए सहकारी संस्था आपसे संपर्क कर सके, इसलिए अपना फोन नंबर जोड़ें।", bookService: "सेवा बुक करें", confirmBooking: "बुकिंग की पुष्टि करें", submitReview: "समीक्षा भेजें", paymentMethod: "भुगतान का तरीका", payNow: "अभी भुगतान करें", cashOnService: "सेवा पर नकद", myBookings: "मेरी बुकिंग", home: "होम", explore: "खोजें" },
  mr: { signIn: "साइन इन", createAccount: "खाते तयार करा", welcomeBack: "पुन्हा स्वागत आहे", continueWithGoogle: "Google सह सुरू ठेवा", joinCooperative: "सहकारी संस्थेत सामील व्हा", forgotPassword: "पासवर्ड विसरलात?", newHere: "नवीन आहात? ", createOne: "खाते तयार करा", back: "मागे", fullName: "पूर्ण नाव", yourName: "तुमचे नाव", enterPassword: "पासवर्ड प्रविष्ट करा", emailAddress: "ईमेल पत्ता", password: "पासवर्ड", language: "भाषा", selectLanguage: "भाषा निवडा", addPhoneNumber: "फोन नंबर जोडा", phoneNumberMissingTitle: "फोन नंबर नाही", phoneNumberMissingCopy: "बुकिंग आणि सेवा अपडेटसाठी सहकारी संस्था तुमच्याशी संपर्क करू शकेल यासाठी तुमचा फोन नंबर जोडा.", bookService: "सेवा बुक करा", confirmBooking: "बुकिंग निश्चित करा", submitReview: "अभिप्राय पाठवा", paymentMethod: "पेमेंट पद्धत", payNow: "आता पेमेंट करा", cashOnService: "सेवावेळी रोख", myBookings: "माझ्या बुकिंग", home: "होम", explore: "शोधा", "Sign in": "साइन इन", "Create account": "खाते तयार करा", "Continue with Google": "Google सह सुरू ठेवा", "Welcome back": "पुन्हा स्वागत आहे", "Email address": "ईमेल पत्ता", "Password": "पासवर्ड", "Book service": "सेवा बुक करा", "Confirm booking": "बुकिंग निश्चित करा", "Submit review": "अभिप्राय पाठवा", "Payment method": "पेमेंट पद्धत", "Cash on Service": "सेवावेळी रोख", "My bookings": "माझ्या बुकिंग", "Profile": "प्रोफाइल", "Home": "होम", "Explore": "शोधा" },
  ta: { signIn: "உள்நுழைக", createAccount: "கணக்கை உருவாக்கு", welcomeBack: "மீண்டும் வரவேற்கிறோம்", continueWithGoogle: "Google மூலம் தொடர்க", joinCooperative: "கூட்டுறவில் சேரவும்", forgotPassword: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?", newHere: "புதியவரா? ", createOne: "கணக்கை உருவாக்கு", back: "பின்", fullName: "முழு பெயர்", yourName: "உங்கள் பெயர்", enterPassword: "கடவுச்சொல் உள்ளிடவும்", emailAddress: "மின்னஞ்சல்", password: "கடவுச்சொல்", language: "மொழி", selectLanguage: "மொழியைத் தேர்ந்தெடுக்கவும்", addPhoneNumber: "தொலைபேசி எண்ணைச் சேர்க்கவும்", phoneNumberMissingTitle: "தொலைபேசி எண் இல்லை", phoneNumberMissingCopy: "முன்பதிவு மற்றும் சேவை புதுப்பிப்புகளுக்காக கூட்டுறவு உங்களைத் தொடர்புகொள்ள உங்கள் தொலைபேசி எண்ணைச் சேர்க்கவும்.", bookService: "சேவையை முன்பதிவு செய்க", confirmBooking: "முன்பதிவை உறுதிசெய்க", submitReview: "மதிப்பாய்வை அனுப்புக", paymentMethod: "கட்டண முறை", payNow: "இப்போது செலுத்துக", cashOnService: "சேவையின் போது பணம்", myBookings: "எனது முன்பதிவுகள்", home: "முகப்பு", explore: "ஆராய்க", "Sign in": "உள்நுழைக", "Create account": "கணக்கை உருவாக்கு", "Continue with Google": "Google மூலம் தொடர்க", "Welcome back": "மீண்டும் வரவேற்கிறோம்", "Email address": "மின்னஞ்சல்", "Password": "கடவுச்சொல்", "Book service": "சேவையை முன்பதிவு செய்க", "Confirm booking": "முன்பதிவை உறுதிசெய்க", "Submit review": "மதிப்பாய்வை அனுப்புக", "Payment method": "கட்டண முறை", "Cash on Service": "சேவையின் போது பணம்", "My bookings": "எனது முன்பதிவுகள்", "Profile": "சுயவிவரம்", "Home": "முகப்பு", "Explore": "ஆராய்க" },
  bn: { signIn: "সাইন ইন", createAccount: "অ্যাকাউন্ট তৈরি করুন", welcomeBack: "আবার স্বাগতম", continueWithGoogle: "Google দিয়ে চালিয়ে যান", joinCooperative: "সমবায়ে যোগ দিন", forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?", newHere: "নতুন? ", createOne: "অ্যাকাউন্ট তৈরি করুন", back: "পিছনে", fullName: "পুরো নাম", yourName: "আপনার নাম", enterPassword: "পাসওয়ার্ড লিখুন", emailAddress: "ইমেল ঠিকানা", password: "পাসওয়ার্ড", language: "ভাষা", selectLanguage: "ভাষা নির্বাচন করুন", addPhoneNumber: "ফোন নম্বর যোগ করুন", phoneNumberMissingTitle: "ফোন নম্বর নেই", phoneNumberMissingCopy: "বুকিং এবং পরিষেবা আপডেটের জন্য সমবায় যাতে আপনার সঙ্গে যোগাযোগ করতে পারে, তাই আপনার ফোন নম্বর যোগ করুন।", bookService: "পরিষেবা বুক করুন", confirmBooking: "বুকিং নিশ্চিত করুন", submitReview: "রিভিউ পাঠান", paymentMethod: "পেমেন্ট পদ্ধতি", payNow: "এখন পেমেন্ট করুন", cashOnService: "পরিষেবার সময় নগদ", myBookings: "আমার বুকিং", home: "হোম", explore: "অন্বেষণ", "Sign in": "সাইন ইন", "Create account": "অ্যাকাউন্ট তৈরি করুন", "Continue with Google": "Google দিয়ে চালিয়ে যান", "Welcome back": "আবার স্বাগতম", "Email address": "ইমেল ঠিকানা", "Password": "পাসওয়ার্ড", "Book service": "পরিষেবা বুক করুন", "Confirm booking": "বুকিং নিশ্চিত করুন", "Submit review": "রিভিউ পাঠান", "Payment method": "পেমেন্ট পদ্ধতি", "Cash on Service": "পরিষেবার সময় নগদ", "My bookings": "আমার বুকিং", "Profile": "প্রোফাইল", "Home": "হোম", "Explore": "অন্বেষণ" },
};
function notify() { listeners.forEach((listener) => listener()); }
function getGlobalLanguage() { return globalLanguage; }
function subscribeToGlobalLanguage(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function setGlobalLanguage(language: LanguageCode) { globalLanguage = language; void AsyncStorage.setItem(STORAGE_KEY, language); notify(); }

export function translateText(key: string, fallback?: string) {
  const translation = dictionary[globalLanguage][key];
  if (translation) return translation;
  if (globalLanguage !== "en") return phraseTranslations[key]?.[globalLanguage] || fallback || key;
  return fallback || key;
}

type I18nValue = { language: LanguageCode; setLanguage: (language: LanguageCode) => void; t: (key: string, fallback?: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeToGlobalLanguage, getGlobalLanguage, getGlobalLanguage);
  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (value && value in languageNames) { globalLanguage = value as LanguageCode; notify(); } }); }, []);
  const value = useMemo<I18nValue>(() => ({ language, setLanguage: setGlobalLanguage, t: translateText }), [language]);
  return React.createElement(I18nContext.Provider, { value }, children);
}
export function useI18n() { const context = useContext(I18nContext); if (!context) throw new Error("useI18n must be used inside I18nProvider"); return context; }
export function GlobalLanguagePicker({ floating = true }: { floating?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  return React.createElement(View, { style: floating ? { position: "absolute", top: 42, right: 14, zIndex: 100, elevation: 100 } : undefined },
    React.createElement(Pressable, { onPress: () => setOpen((value) => !value), style: { alignSelf: "flex-end", borderColor: "#A8D5CE", borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FFFFFF", shadowColor: "#102A43", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 } },
      React.createElement(Text, { style: { color: "#0F766E", fontWeight: "800" } }, `${t("language", "Language")}: ${languageNames[language]}`)),
    open && React.createElement(View, { style: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, marginTop: 6, padding: 6, gap: 2 } },
      Object.entries(languageNames).map(([code, name]) => React.createElement(Pressable, { key: code, onPress: () => { setLanguage(code as LanguageCode); setOpen(false); }, style: { paddingHorizontal: 10, paddingVertical: 9, backgroundColor: language === code ? "#CCFBF1" : "#FFFFFF", borderRadius: 8 } }, React.createElement(Text, { style: { color: "#102A43", fontWeight: language === code ? "800" : "500" } }, name))))
  );
}
function localizeTextNode(value: string, t: I18nValue["t"]) {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match?.[2]) return value;
  return `${match[1]}${t(match[2], match[2])}${match[3]}`;
}

function localizeChildren(children: React.ReactNode, t: I18nValue["t"]): React.ReactNode {
  if (typeof children === "string") return localizeTextNode(children, t);
  if (Array.isArray(children)) return children.map((child, index) => typeof child === "string" ? React.createElement(React.Fragment, { key: index }, localizeTextNode(child, t)) : child);
  return children;
}

export function LocalizedText({ children, translationKey, ...props }: React.ComponentProps<typeof Text> & { translationKey?: string }) {
  const { t } = useI18n();
  const value = translationKey ? t(translationKey, typeof children === "string" ? children : translationKey) : localizeChildren(children, t);
  return React.createElement(Text, props, value);
}
export function LocalizedTextInput({ placeholder, ...props }: React.ComponentProps<typeof TextInput>) { const { t } = useI18n(); return React.createElement(TextInput, { ...props, placeholder: placeholder ? t(placeholder, placeholder) : placeholder }); }

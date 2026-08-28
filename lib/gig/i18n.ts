import type { LanguageCode } from "./models";

export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
];

const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    profile: "Profile", bookings: "My bookings", explore: "Explore local help", servicesNearYou: "Services near you", availableNearby: "available nearby", messageWorker: "Message worker", callWorker: "Call worker", submitForReview: "Submit for review", emergency: "Emergency", onDemand: "On demand", standard: "Standard", language: "Language", saveChanges: "Save changes", noBookings: "No bookings yet", payment: "Payment", invoice: "Invoice",
  },
  te: {
    profile: "ప్రొఫైల్", bookings: "నా బుకింగ్స్", explore: "స్థానిక సహాయం", servicesNearYou: "మీ దగ్గర సేవలు", availableNearby: "దగ్గరలో అందుబాటులో", messageWorker: "వర్కర్‌కు మెసేజ్", callWorker: "వర్కర్‌కు కాల్", submitForReview: "రివ్యూ కోసం పంపండి", emergency: "అత్యవసరం", onDemand: "తక్షణ సేవ", standard: "సాధారణం", language: "భాష", saveChanges: "మార్పులను సేవ్ చేయండి", noBookings: "ఇంకా బుకింగ్స్ లేవు", payment: "చెల్లింపు", invoice: "ఇన్వాయిస్",
  },
  hi: {
    profile: "प्रोफ़ाइल", bookings: "मेरी बुकिंग", explore: "स्थानीय सहायता खोजें", servicesNearYou: "आपके पास सेवाएं", availableNearby: "पास में उपलब्ध", messageWorker: "वर्कर को संदेश", callWorker: "वर्कर को कॉल", submitForReview: "समीक्षा के लिए भेजें", emergency: "आपातकालीन", onDemand: "तुरंत सेवा", standard: "सामान्य", language: "भाषा", saveChanges: "बदलाव सेव करें", noBookings: "अभी कोई बुकिंग नहीं", payment: "भुगतान", invoice: "चालान",
  },
};

export function translate(language: LanguageCode | undefined, key: string) {
  return translations[language || "en"]?.[key] || translations.en[key] || key;
}

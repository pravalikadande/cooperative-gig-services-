import type { LanguageCode } from "./models";

export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
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
  mr: {
    profile: "प्रोफाइल", bookings: "माझ्या बुकिंग", explore: "स्थानिक मदत शोधा", servicesNearYou: "तुमच्या जवळील सेवा", availableNearby: "जवळ उपलब्ध", messageWorker: "कामगाराला संदेश", callWorker: "कामगाराला कॉल", submitForReview: "अभिप्राय पाठवा", emergency: "आपत्कालीन", onDemand: "त्वरित सेवा", standard: "सामान्य", language: "भाषा", saveChanges: "बदल जतन करा", noBookings: "अजून बुकिंग नाही", payment: "पेमेंट", invoice: "पावती",
  },
  ta: {
    profile: "சுயவிவரம்", bookings: "எனது முன்பதிவுகள்", explore: "உள்ளூர் உதவியைத் தேடுங்கள்", servicesNearYou: "உங்களுக்கு அருகிலுள்ள சேவைகள்", availableNearby: "அருகில் கிடைக்கும்", messageWorker: "பணியாளருக்கு செய்தி", callWorker: "பணியாளரை அழைக்கவும்", submitForReview: "மதிப்பாய்வை அனுப்புக", emergency: "அவசரம்", onDemand: "தேவைக்கேற்ப", standard: "சாதாரணம்", language: "மொழி", saveChanges: "மாற்றங்களைச் சேமிக்கவும்", noBookings: "முன்பதிவுகள் இல்லை", payment: "கட்டணம்", invoice: "விலைப்பட்டியல்",
  },
  bn: {
    profile: "প্রোফাইল", bookings: "আমার বুকিং", explore: "স্থানীয় সহায়তা খুঁজুন", servicesNearYou: "আপনার কাছাকাছি পরিষেবা", availableNearby: "কাছাকাছি উপলব্ধ", messageWorker: "কর্মীকে বার্তা", callWorker: "কর্মীকে কল", submitForReview: "রিভিউ পাঠান", emergency: "জরুরি", onDemand: "চাহিদা অনুযায়ী", standard: "সাধারণ", language: "ভাষা", saveChanges: "পরিবর্তন সংরক্ষণ করুন", noBookings: "এখনও কোনো বুকিং নেই", payment: "পেমেন্ট", invoice: "চালান",
  },
};

export function translate(language: LanguageCode | undefined, key: string) {
  return translations[language || "en"]?.[key] || translations.en[key] || key;
}

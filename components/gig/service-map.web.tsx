import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/lib/i18n";

export function ServiceMap({ label }: { latitude: number; longitude: number; label: string }) {
  return <View style={styles.mapFallback}><View style={styles.pin}><MaterialIcons name="location-on" size={24} color="#0F766E" /></View><Text style={styles.label}>{label}</Text><Text translationKey="Interactive map appears in the Android or iOS build." style={styles.copy}>Interactive map appears in the Android or iOS build.</Text></View>;
}

const styles = StyleSheet.create({
  mapFallback: { alignItems: "center", backgroundColor: "#E6FFFA", borderColor: "#99F6E4", borderRadius: 14, borderWidth: 1, height: 148, justifyContent: "center", marginBottom: 15, padding: 16 },
  pin: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  label: { color: "#102A43", fontSize: 13, fontWeight: "800", marginTop: 8, textAlign: "center" },
  copy: { color: "#486581", fontSize: 11, marginTop: 4, textAlign: "center" },
});

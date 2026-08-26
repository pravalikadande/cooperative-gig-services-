import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet, Text, View } from "react-native";

import { shouldRenderNativeGoogleMap } from "@/lib/gig/maps";

export function ServiceMap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  if (!shouldRenderNativeGoogleMap(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)) {
    return <View style={styles.mapFallback}><View style={styles.pin}><MaterialIcons name="location-on" size={24} color="#0F766E" /></View><Text style={styles.label}>{label}</Text><Text style={styles.copy}>Service location saved. Interactive map will appear after Google Maps is configured.</Text></View>;
  }
  return <View style={styles.wrap}><MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ latitude, longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }}><Marker coordinate={{ latitude, longitude }} title="Service location" description={label} /></MapView></View>;
}

const styles = StyleSheet.create({
  wrap: { borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, height: 148, marginBottom: 15, overflow: "hidden" },
  map: { height: "100%", width: "100%" },
  mapFallback: { alignItems: "center", backgroundColor: "#E6FFFA", borderColor: "#99F6E4", borderRadius: 14, borderWidth: 1, height: 148, justifyContent: "center", marginBottom: 15, padding: 16 },
  pin: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  label: { color: "#102A43", fontSize: 13, fontWeight: "800", marginTop: 8, textAlign: "center" },
  copy: { color: "#486581", fontSize: 11, marginTop: 4, textAlign: "center" },
});

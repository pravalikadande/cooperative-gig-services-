import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { StyleSheet, View } from "react-native";

export function ServiceMap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  return <View style={styles.wrap}><MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ latitude, longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }}><Marker coordinate={{ latitude, longitude }} title="Service location" description={label} /></MapView></View>;
}

const styles = StyleSheet.create({
  wrap: { borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, height: 148, marginBottom: 15, overflow: "hidden" },
  map: { height: "100%", width: "100%" },
});

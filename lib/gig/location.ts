import * as Location from "expo-location";

export type CurrentLocationResult =
  | { ok: true; latitude: number; longitude: number; label: string }
  | { ok: false; message: string };

export async function requestCurrentServiceLocation(): Promise<CurrentLocationResult> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { ok: false, message: "Location services are turned off. Enable them in device settings to use your current service address." };
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    return { ok: false, message: "Location permission was not granted. You can enter your service address manually." };
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const addresses = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
  const address = addresses[0];
  const label = [address?.name, address?.district || address?.city, address?.region]
    .filter(Boolean)
    .join(", ") || "Current service location";

  return {
    ok: true,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    label,
  };
}

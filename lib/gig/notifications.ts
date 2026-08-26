import Constants from "expo-constants";
import { Platform } from "react-native";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { firestore } from "./firebase";

export async function registerDeviceForFirebaseMessaging(userId: string) {
  // Android Expo Go removed remote push support in SDK 53. Avoid loading the
  // native push module in Expo Go; development/release builds still register.
  if (!firestore || Platform.OS === "web" || Constants.appOwnership === "expo") return null;

  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("gig-services", {
      name: "Service updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#0F766E",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = typeof deviceToken.data === "string" ? deviceToken.data : JSON.stringify(deviceToken.data);
  await setDoc(
    doc(firestore, "deviceTokens", `${userId}_${Platform.OS}`),
    {
      userId,
      token,
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

// Load environment variables with proper priority (system > .env)

import "./scripts/load-env.js";

import type { ExpoConfig } from "expo/config";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>

// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"

// Bundle ID can only contain letters, numbers, and dots

// Android requires each dot-separated segment to start with a letter

const rawBundleId = "com.app.cooperativegigservicesv2";

const bundleId = rawBundleId
  .replace(/[-_]/g, ".")
  .replace(/[^a-zA-Z0-9.]/g, "")
  .replace(/\.{2,}/g, ".")
  .replace(/^\.|\.$/g, "")
  .toLowerCase()
  .split(".")
  .map((segment) => {
    // Android requires each segment to start with a letter
    // Prefix with "x" if segment starts with a digit
    return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
  })
  .join(".") || "space.manus.app";

// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"

const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";

const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)

  appName: "Cooperative Gig Services",

  appSlug: "cooperative-gig-services-v2",

  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png

  logoUrl: "/manus-storage/cooperative-gig-services-icon_5f6d55f2.png",

  scheme: schemeFromBundleId,

  iosBundleId: bundleId,

  androidPackage: bundleId,
};

const config: ExpoConfig = {
  // Expo account that owns the EAS project
  owner: "siddhu_buddi_2023",

  name: env.appName,

  slug: env.appSlug,

  version: "1.0.0",

  orientation: "portrait",

  icon: "./assets/images/icon.png",

  scheme: env.scheme,

  userInterfaceStyle: "automatic",

  newArchEnabled: true,

  ios: {
    supportsTablet: true,

    bundleIdentifier: env.iosBundleId,

    config: {
      googleMapsApiKey:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    },

    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,

      LSApplicationQueriesSchemes: ["tel"],
    },
  },

  android: {
    googleServicesFile: "./google-services.json",

    adaptiveIcon: {
      backgroundColor: "#E6F4FE",

      foregroundImage:
        "./assets/images/android-icon-foreground.png",

      backgroundImage:
        "./assets/images/android-icon-background.png",

      monochromeImage:
        "./assets/images/android-icon-monochrome.png",
    },

    edgeToEdgeEnabled: true,

    predictiveBackGestureEnabled: false,

    package: env.androidPackage,

    config: {
      googleMaps: {
        apiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
    },

    permissions: [
      "POST_NOTIFICATIONS",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
    ],

    intentFilters: [
      {
        action: "VIEW",

        autoVerify: true,

        data: [
          {
            scheme: env.scheme,

            host: "*",
          },
        ],

        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },

  web: {
    bundler: "metro",

    output: "static",

    favicon: "./assets/images/favicon.png",
  },

  extra: {
    something: "...",

    // NEW EAS PROJECT
    eas: {
      projectId: "c3d055b3-ea9f-4a01-9cc9-ae216e188c54",
    },

    firebase: {
      apiKey:
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",

      authDomain:
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",

      projectId:
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",

      storageBucket:
        process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",

      messagingSenderId:
        process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",

      appId:
        process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
    },

    google: {
      androidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",

      iosClientId:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",

      webClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    },
  },

  plugins: [
    "@react-native-google-signin/google-signin",

    "expo-router",

    "expo-font",

    "expo-web-browser",

    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow $(PRODUCT_NAME) to use your location to show nearby cooperative workers and service addresses.",
      },
    ],

    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow $(PRODUCT_NAME) to access a service photo for your booking.",

        cameraPermission:
          "Allow $(PRODUCT_NAME) to take a service photo for your booking.",
      },
    ],

    [
      "expo-notifications",
      {
        icon: "./assets/images/android-icon-monochrome.png",

        color: "#0F766E",

        defaultChannel: "gig-services",
      },
    ],

    [
      "expo-audio",
      {
        microphonePermission:
          "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],

    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,

        supportsPictureInPicture: true,
      },
    ],

    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",

        imageWidth: 200,

        resizeMode: "contain",

        backgroundColor: "#ffffff",

        dark: {
          backgroundColor: "#000000",
        },
      },
    ],

    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],

          minSdkVersion: 24,
        },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,

    reactCompiler: true,
  },
};

export default config;
import { describe, expect, it } from "vitest";

const requiredKeys = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
] as const;

describe("user-owned Firebase configuration", () => {
  it("contains the required user-owned Firebase application settings", () => {
    for (const key of requiredKeys) {
      expect(process.env[key], `${key} must be configured`).toBeTruthy();
    }
  });

  it("reaches the configured Firestore project without an invalid API-key response", async () => {
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents?pageSize=1&key=${apiKey}`,
    );
    const body = await response.text();

    expect(body).not.toContain("API key not valid");
    expect(body).not.toContain("API_KEY_INVALID");
    expect(body).not.toContain("The provided API key is invalid");
  });
});

import { describe, expect, it } from "vitest";

describe("Firebase Authentication API key", () => {
  it("is accepted by the Identity Toolkit endpoint without creating an account", async () => {
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey ?? "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    const message = payload.error?.message ?? "";

    expect(message).not.toContain("API_KEY_INVALID");
    expect(message).not.toContain("API_KEY_NOT_VALID");
    expect(["MISSING_EMAIL", "ADMIN_ONLY_OPERATION"]).toContain(message);
  });
});

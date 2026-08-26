import { describe, expect, it } from "vitest";

import { buildWorkerDirectoryProfile, toWorkerList, workerProfileFirestorePayload } from "../lib/gig/worker-directory";

const workerUser = {
  id: "worker-live-1",
  name: "Ravi Kumar",
  email: "ravi@example.com",
  role: "worker" as const,
  createdAt: "2026-08-26T00:00:00.000Z",
};

describe("worker directory profiles", () => {
  it("publishes a new worker with safe customer-facing defaults", () => {
    const profile = buildWorkerDirectoryProfile(workerUser, { services: "Plumber, Handyman", serviceArea: "Madhapur", isOnline: true });
    expect(profile.userId).toBe(workerUser.id);
    expect(profile.services).toEqual(["Plumber", "Handyman"]);
    expect(profile.isOnline).toBe(true);
    expect(profile.isVerified).toBe(false);
  });

  it("retains ratings and verification when a worker changes public details", () => {
    const profile = buildWorkerDirectoryProfile(workerUser, { services: "Electrician", isOnline: false }, { rating: 4.8, reviewCount: 12, isVerified: true, services: ["Plumber"] });
    expect(profile.services).toEqual(["Electrician"]);
    expect(profile.isOnline).toBe(false);
    expect(profile.rating).toBe(4.8);
    expect(profile.reviewCount).toBe(12);
    expect(profile.isVerified).toBe(true);
  });

  it("normalizes comma-separated or array service values", () => {
    expect(toWorkerList(" Cleaner, Cleaner , Driver ")).toEqual(["Cleaner", "Driver"]);
    expect(toWorkerList(["Plumber", "Electrician"])).toEqual(["Plumber", "Electrician"]);
  });

  it("omits empty optional values from the Firestore write payload", () => {
    const profile = buildWorkerDirectoryProfile(workerUser, undefined);
    const payload = workerProfileFirestorePayload(profile);
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("profileImage");
    expect(payload).not.toHaveProperty("location");
  });
});

import type { AppUser, Coordinate, WorkerProfile } from "./models";

export type WorkerProfileDraftInput = Record<string, unknown> | undefined;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function toWorkerList(value: unknown, fallback: string[] = []) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const cleaned = rawItems
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length ? [...new Set(cleaned)] : fallback;
}

export function buildWorkerDirectoryProfile(
  user: AppUser,
  draft: WorkerProfileDraftInput,
  existing?: Partial<WorkerProfile>,
): WorkerProfile {
  const services = toWorkerList(draft?.services, existing?.services?.length ? existing.services : ["Local service"]);
  const skills = toWorkerList(draft?.skills, existing?.skills?.length ? existing.skills : services);
  const location = user.location ?? existing?.location;

  return {
    id: user.id,
    userId: user.id,
    name: stringValue(draft?.name, user.name || existing?.name || "Service partner"),
    phone: stringValue(draft?.phone, user.phone || existing?.phone || "") || undefined,
    profileImage: user.profileImage ?? existing?.profileImage,
    services,
    skills,
    experienceYears: numberValue(draft?.experienceYears, existing?.experienceYears ?? 0),
    rating: numberValue(existing?.rating, 0),
    reviewCount: numberValue(existing?.reviewCount, 0),
    location: location as Coordinate | undefined,
    serviceArea: stringValue(draft?.serviceArea, existing?.serviceArea || user.address || "Service area to be updated"),
    isOnline: booleanValue(draft?.isOnline, existing?.isOnline ?? true),
    // Worker accounts cannot self-verify; only an administrator should change this field.
    isVerified: booleanValue(existing?.isVerified, false),
    availability: stringValue(draft?.availability, existing?.availability || "Available — update working hours"),
    startingPrice: numberValue(draft?.startingPrice, existing?.startingPrice ?? 0),
    about: stringValue(draft?.about, existing?.about || "Cooperative service professional."),
  };
}

/** Firestore rejects undefined values, so optional public fields must be omitted from write payloads. */
export function workerProfileFirestorePayload(profile: WorkerProfile): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined),
  );
}

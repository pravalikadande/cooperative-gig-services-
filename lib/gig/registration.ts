import type { UserRole } from "./models";

export const PUBLIC_REGISTRATION_ROLES = ["customer", "worker"] as const;

export function isPublicRegistrationRole(role: UserRole): role is (typeof PUBLIC_REGISTRATION_ROLES)[number] {
  return (PUBLIC_REGISTRATION_ROLES as readonly UserRole[]).includes(role);
}

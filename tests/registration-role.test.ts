import { describe, expect, it } from "vitest";

import { isPublicRegistrationRole, PUBLIC_REGISTRATION_ROLES } from "../lib/gig/registration";

describe("public registration roles", () => {
  it("allows only customer and worker self-registration", () => {
    expect(PUBLIC_REGISTRATION_ROLES).toEqual(["customer", "worker"]);
    expect(isPublicRegistrationRole("customer")).toBe(true);
    expect(isPublicRegistrationRole("worker")).toBe(true);
    expect(isPublicRegistrationRole("admin")).toBe(false);
  });
});

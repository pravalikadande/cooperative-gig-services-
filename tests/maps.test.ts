import { describe, expect, it } from "vitest";

import { shouldRenderNativeGoogleMap } from "../lib/gig/maps";

describe("native booking map guard", () => {
  it("uses the safe booking location fallback when a deployed binary has no Maps key", () => {
    expect(shouldRenderNativeGoogleMap(undefined)).toBe(false);
    expect(shouldRenderNativeGoogleMap("   ")).toBe(false);
  });

  it("allows the native map only after a non-empty Maps key is configured", () => {
    expect(shouldRenderNativeGoogleMap("AIza-example-maps-key")).toBe(true);
  });
});

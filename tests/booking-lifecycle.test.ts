import { describe, expect, it } from "vitest";

import {
  canLeaveReview,
  canTransitionBooking,
  isBookingContactEligible,
} from "../lib/gig/booking-lifecycle";

describe("cooperative gig booking lifecycle", () => {
  it("allows only the approved job-status progression", () => {
    expect(canTransitionBooking("pending", "accepted")).toBe(true);
    expect(canTransitionBooking("accepted", "confirmed")).toBe(true);
    expect(canTransitionBooking("confirmed", "in_progress")).toBe(true);
    expect(canTransitionBooking("in_progress", "completed")).toBe(true);
    expect(canTransitionBooking("pending", "completed")).toBe(false);
  });

  it("enables contact only after a valid work relationship begins", () => {
    expect(isBookingContactEligible("pending")).toBe(false);
    expect(isBookingContactEligible("accepted")).toBe(true);
    expect(isBookingContactEligible("in_progress")).toBe(true);
    expect(isBookingContactEligible("completed")).toBe(false);
  });

  it("prevents duplicate reviews and requires completion", () => {
    expect(canLeaveReview("completed", false)).toBe(true);
    expect(canLeaveReview("completed", true)).toBe(false);
    expect(canLeaveReview("in_progress", false)).toBe(false);
  });
});

import type { BookingStatus } from "./models";

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["confirmed", "cancelled"],
  rejected: [],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus) {
  return TRANSITIONS[from].includes(to);
}

export function isBookingContactEligible(status: BookingStatus) {
  return status === "accepted" || status === "confirmed" || status === "in_progress";
}

export function canLeaveReview(status: BookingStatus, hasExistingReview: boolean) {
  return status === "completed" && !hasExistingReview;
}

export function bookingStatusLabel(status: BookingStatus) {
  return {
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
    confirmed: "Confirmed",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[status];
}

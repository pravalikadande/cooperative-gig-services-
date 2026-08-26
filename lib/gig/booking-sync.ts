import type { Booking, BookingStatus } from "./models";

export type BookingRequestInput = Omit<Booking, "id" | "status" | "createdAt" | "updatedAt">;

/** Firestore rejects undefined values, so omit optional fields that are not supplied. */
export function bookingFirestorePayload(input: BookingRequestInput): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function bookingsForWorkerStatus(bookings: Booking[], statuses: BookingStatus[]) {
  return bookings.filter((booking) => statuses.includes(booking.status));
}

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { createRazorpayOrder, handleRazorpayWebhook } from "./razorpay";

initializeApp();

const db = getFirestore();

type Booking = {
  customerId: string;
  workerId: string;
  serviceName: string;
  status: string;
};

type Payment = {
  bookingId: string;
  customerId: string;
  workerId: string;
  amount: number;
  status: string;
};

async function notifyUser(userId: string, title: string, body: string, data: Record<string, string>) {
  const snapshot = await db.collection("deviceTokens").where("userId", "==", userId).get();
  const tokens = snapshot.docs.map((item) => item.data().token).filter((token): token is string => typeof token === "string");
  if (!tokens.length) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { notification: { channelId: "gig-services" } },
  });

  const invalidTokens = response.responses
    .map((result, index) => (!result.success ? tokens[index] : null))
    .filter((token): token is string => Boolean(token));
  if (invalidTokens.length) {
    const stale = snapshot.docs.filter((item) => invalidTokens.includes(item.data().token));
    await Promise.all(stale.map((item) => item.ref.delete()));
  }
}

export const notifyWorkerOfBookingRequest = onDocumentCreated("bookings/{bookingId}", async (event) => {
  const booking = event.data?.data() as Booking | undefined;
  if (!booking) return;
  await notifyUser(
    booking.workerId,
    "New booking request",
    `A customer requested ${booking.serviceName}.`,
    { type: "booking_request", bookingId: event.params.bookingId },
  );
});

export const notifyBookingStatusChange = onDocumentUpdated("bookings/{bookingId}", async (event) => {
  const before = event.data?.before.data() as Booking | undefined;
  const after = event.data?.after.data() as Booking | undefined;
  if (!before || !after || before.status === after.status) return;

  const customerStatuses = new Set(["accepted", "rejected", "confirmed", "in_progress", "completed", "cancelled"]);
  const workerStatuses = new Set(["cancelled"]);
  const target = customerStatuses.has(after.status) ? after.customerId : workerStatuses.has(after.status) ? after.workerId : null;
  if (!target) return;
  await notifyUser(
    target,
    `Booking ${after.status.replace("_", " ")}`,
    `${after.serviceName} has been marked ${after.status.replace("_", " ")}.`,
    { type: "booking_status", bookingId: event.params.bookingId, status: after.status },
  );
});

export const createRazorpayOrderHttp = onRequest({ cors: true }, createRazorpayOrder);
export const razorpayWebhook = onRequest({ cors: false }, handleRazorpayWebhook);

export const notifyPaymentStatusChange = onDocumentUpdated("payments/{paymentId}", async (event) => {
  const before = event.data?.before.data() as Payment | undefined;
  const after = event.data?.after.data() as Payment | undefined;
  if (!before || !after || before.status === after.status) return;
  if (after.status !== "paid" && after.status !== "failed") return;
  const title = after.status === "paid" ? "Payment confirmed" : "Payment failed";
  const body = after.status === "paid" ? `₹${after.amount} payment confirmed. Your invoice is ready.` : `Payment for booking ${after.bookingId} failed. You can retry from the app.`;
  await notifyUser(after.customerId, title, body, { type: "payment_status", paymentId: event.params.paymentId, bookingId: after.bookingId, status: after.status });
  if (after.status === "paid") await notifyUser(after.workerId, "Booking payment confirmed", `Payment for booking ${after.bookingId} is confirmed.`, { type: "payment_status", paymentId: event.params.paymentId, bookingId: after.bookingId, status: after.status });
});

export const notifyNewChatMessage = onDocumentCreated("chats/{bookingId}/messages/{messageId}", async (event) => {
  const message = event.data?.data() as { senderId?: string; receiverId?: string; message?: string } | undefined;
  if (!message?.receiverId || !message.senderId) return;
  await notifyUser(
    message.receiverId,
    "New booking message",
    message.message?.slice(0, 120) || "You received a message about your booking.",
    { type: "chat", bookingId: event.params.bookingId, senderId: message.senderId },
  );
});

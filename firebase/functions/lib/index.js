"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyNewChatMessage = exports.notifyBookingStatusChange = exports.notifyWorkerOfBookingRequest = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const firestore_2 = require("firebase-functions/v2/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
async function notifyUser(userId, title, body, data) {
    const snapshot = await db.collection("deviceTokens").where("userId", "==", userId).get();
    const tokens = snapshot.docs.map((item) => item.data().token).filter((token) => typeof token === "string");
    if (!tokens.length)
        return;
    const response = await (0, messaging_1.getMessaging)().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
        android: { notification: { channelId: "gig-services" } },
    });
    const invalidTokens = response.responses
        .map((result, index) => (!result.success ? tokens[index] : null))
        .filter((token) => Boolean(token));
    if (invalidTokens.length) {
        const stale = snapshot.docs.filter((item) => invalidTokens.includes(item.data().token));
        await Promise.all(stale.map((item) => item.ref.delete()));
    }
}
exports.notifyWorkerOfBookingRequest = (0, firestore_2.onDocumentCreated)("bookings/{bookingId}", async (event) => {
    const booking = event.data?.data();
    if (!booking)
        return;
    await notifyUser(booking.workerId, "New booking request", `A customer requested ${booking.serviceName}.`, { type: "booking_request", bookingId: event.params.bookingId });
});
exports.notifyBookingStatusChange = (0, firestore_2.onDocumentUpdated)("bookings/{bookingId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status)
        return;
    const customerStatuses = new Set(["accepted", "rejected", "confirmed", "in_progress", "completed", "cancelled"]);
    const workerStatuses = new Set(["cancelled"]);
    const target = customerStatuses.has(after.status) ? after.customerId : workerStatuses.has(after.status) ? after.workerId : null;
    if (!target)
        return;
    await notifyUser(target, `Booking ${after.status.replace("_", " ")}`, `${after.serviceName} has been marked ${after.status.replace("_", " ")}.`, { type: "booking_status", bookingId: event.params.bookingId, status: after.status });
});
exports.notifyNewChatMessage = (0, firestore_2.onDocumentCreated)("chats/{bookingId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message?.receiverId || !message.senderId)
        return;
    await notifyUser(message.receiverId, "New booking message", message.message?.slice(0, 120) || "You received a message about your booking.", { type: "chat", bookingId: event.params.bookingId, senderId: message.senderId });
});

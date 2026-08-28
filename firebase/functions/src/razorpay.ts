import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const firestore = () => getFirestore();
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};
const respond = (res: any, status: number, body: unknown) => res.status(status).json(body);

export async function createRazorpayOrder(req: any, res: any) {
  if (req.method !== "POST") return respond(res, 405, { error: "Method not allowed" });
  try {
    const header = String(req.headers.authorization ?? "");
    if (!header.startsWith("Bearer ")) return respond(res, 401, { error: "Missing Firebase authentication token" });
    const user = await getAuth().verifyIdToken(header.slice(7));
    const bookingId = req.body?.bookingId;
    if (typeof bookingId !== "string" || !bookingId) return respond(res, 400, { error: "bookingId is required" });
    const db = firestore();
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const bookingSnapshot = await bookingRef.get();
    if (!bookingSnapshot.exists) return respond(res, 404, { error: "Booking not found" });
    const booking = bookingSnapshot.data() as Record<string, any>;
    if (booking.customerId !== user.uid) return respond(res, 403, { error: "Only the booking customer can pay" });
    if (!["accepted", "confirmed", "in_progress"].includes(booking.status)) return respond(res, 409, { error: "Payment is available after worker acceptance" });
    if (booking.paymentStatus === "paid") return respond(res, 409, { error: "Booking is already paid" });
    const amount = Number(booking.price);
    if (!Number.isInteger(amount) || amount <= 0) return respond(res, 400, { error: "Booking price is invalid" });
    const keyId = required("RAZORPAY_KEY_ID");
    const keySecret = required("RAZORPAY_KEY_SECRET");
    const gateway = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt: bookingId }) });
    if (!gateway.ok) return respond(res, 502, { error: "Razorpay order creation failed" });
    const order = await gateway.json() as { id: string; amount: number; currency: string };
    const paymentRef = db.collection("payments").doc();
    const fee = Math.round(amount * 0.05);
    await paymentRef.set({ bookingId, customerId: booking.customerId, workerId: booking.workerId, amount, cooperativeFee: fee, workerPayout: amount - fee, gateway: "razorpay", status: "pending", razorpayOrderId: order.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await bookingRef.update({ paymentStatus: "pending", paymentId: paymentRef.id, updatedAt: FieldValue.serverTimestamp() });
    return respond(res, 200, { keyId, orderId: order.id, paymentRecordId: paymentRef.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error("Razorpay order error", error);
    return respond(res, 500, { error: "Unable to create payment order" });
  }
}

function validSignature(payload: Buffer, signature: string, secret: string) {
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function handleRazorpayWebhook(req: any, res: any) {
  if (req.method !== "POST") return respond(res, 405, { error: "Method not allowed" });
  try {
    const payload = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string" || !validSignature(payload, signature, required("RAZORPAY_WEBHOOK_SECRET"))) return respond(res, 401, { error: "Invalid webhook signature" });
    const event = req.body as { event?: string; payload?: { payment?: { entity?: Record<string, any> } } };
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id) return respond(res, 200, { received: true });
    const db = firestore();
    const snapshot = await db.collection("payments").where("razorpayOrderId", "==", payment.order_id).limit(1).get();
    if (snapshot.empty) return respond(res, 200, { received: true });
    const paymentDoc = snapshot.docs[0];
    const record = paymentDoc.data() as Record<string, any>;
    const bookingRef = db.doc(`bookings/${record.bookingId}`);
    if (event.event === "payment.captured" || event.event === "order.paid") {
      if (Number(payment.amount) !== Number(record.amount) * 100) return respond(res, 400, { error: "Webhook amount does not match booking" });
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(paymentDoc.ref);
        if (current.data()?.status === "paid") return;
        const invoiceRef = db.collection("invoices").doc();
        transaction.update(paymentDoc.ref, { status: "paid", razorpayPaymentId: payment.id, updatedAt: FieldValue.serverTimestamp() });
        transaction.update(bookingRef, { paymentStatus: "paid", invoiceId: invoiceRef.id, updatedAt: FieldValue.serverTimestamp() });
        transaction.set(invoiceRef, { bookingId: record.bookingId, customerId: record.customerId, workerId: record.workerId, subtotal: record.amount, cooperativeFee: record.cooperativeFee, total: record.amount, status: "paid", issuedAt: FieldValue.serverTimestamp() });
      });
    } else if (event.event === "payment.failed") {
      await paymentDoc.ref.update({ status: "failed", razorpayPaymentId: payment.id, updatedAt: FieldValue.serverTimestamp() });
      await bookingRef.update({ paymentStatus: "failed", updatedAt: FieldValue.serverTimestamp() });
    }
    return respond(res, 200, { received: true });
  } catch (error) {
    console.error("Razorpay webhook error", error);
    return respond(res, 500, { error: "Webhook processing failed" });
  }
}

export const webhookSignature = (payload: Buffer, secret: string) => createHmac("sha256", secret).update(payload).digest("hex");
export const toMinorUnits = (amount: number) => Math.round(amount * 100);
export const cooperativeFee = (amount: number) => Math.round(amount * 0.05);
export const workerPayout = (amount: number) => amount - cooperativeFee(amount);
export const paymentEventStatus = (event: string): "paid" | "failed" | null => event === "payment.captured" || event === "order.paid" ? "paid" : event === "payment.failed" ? "failed" : null;

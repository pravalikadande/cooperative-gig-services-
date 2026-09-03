import "dotenv/config";
import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

function getFirebase() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccount) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization") || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Missing Firebase authorization token" });
    const decoded = await getFirebase().auth.verifyIdToken(header.slice(7));
    res.locals.uid = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid Firebase authorization token" });
  }
}

function hmac(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function createRazorpayOrder(req: Request, res: Response) {
  try {
    const { bookingId } = req.body as { bookingId?: string };
    const uid = String(res.locals.uid);
    if (!bookingId) return res.status(400).json({ error: "bookingId is required" });
    const { db } = getFirebase();
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const bookingSnapshot = await bookingRef.get();
    if (!bookingSnapshot.exists) return res.status(404).json({ error: "Booking not found" });
    const booking = bookingSnapshot.data() as Record<string, unknown>;
    if (booking.customerId !== uid) return res.status(403).json({ error: "Only the booking customer can pay" });
    if (!["accepted", "confirmed", "in_progress", "completed"].includes(String(booking.status))) return res.status(409).json({ error: "Payment is available after worker acceptance" });
    if (booking.paymentStatus === "paid") return res.status(409).json({ error: "Booking is already paid" });
    const amount = Number(booking.price);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Booking amount is invalid" });

    const keyId = required("RAZORPAY_KEY_ID");
    const keySecret = required("RAZORPAY_KEY_SECRET");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR", receipt: bookingId, notes: { bookingId, customerId: uid } }),
    });
    const order = await response.json() as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
    if (!response.ok || !order.id) return res.status(502).json({ error: order.error?.description || "Razorpay order creation failed" });

    const paymentRef = db.collection("payments").doc();
    const fee = Math.round(amount * 0.05);
    await paymentRef.set({ bookingId, customerId: uid, workerId: booking.workerId, amount, cooperativeFee: fee, workerPayout: amount - fee, gateway: "razorpay", status: "pending", razorpayOrderId: order.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await bookingRef.update({ paymentStatus: "pending", paymentId: paymentRef.id, updatedAt: FieldValue.serverTimestamp() });
    return res.json({ keyId, orderId: order.id, paymentRecordId: paymentRef.id, amount: order.amount, currency: order.currency || "INR" });
  } catch (error) {
    console.error("createRazorpayOrderHttp failed", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create payment order" });
  }
}

async function verifyPayment(req: Request, res: Response) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body as Record<string, string>;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) return res.status(400).json({ error: "Payment verification fields are required" });
    const uid = String(res.locals.uid);
    const { db } = getFirebase();
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const booking = (await bookingRef.get()).data() as Record<string, unknown> | undefined;
    if (!booking || booking.customerId !== uid) return res.status(403).json({ error: "Booking access denied" });
    const expected = hmac(`${razorpay_order_id}|${razorpay_payment_id}`, required("RAZORPAY_KEY_SECRET"));
    if (!safeEqual(expected, razorpay_signature)) return res.status(400).json({ error: "Invalid payment signature" });
    const paymentQuery = await db.collection("payments").where("razorpayOrderId", "==", razorpay_order_id).limit(1).get();
    if (paymentQuery.empty) return res.status(404).json({ error: "Payment record not found" });
    const paymentRef = paymentQuery.docs[0].ref;
    const invoiceRef = db.collection("invoices").doc();
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(paymentRef);
      if (current.data()?.status === "paid") return;
      transaction.update(paymentRef, { status: "paid", razorpayPaymentId: razorpay_payment_id, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(bookingRef, { paymentStatus: "paid", invoiceId: invoiceRef.id, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(invoiceRef, { bookingId, customerId: booking.customerId, workerId: booking.workerId, subtotal: booking.price, total: booking.price, status: "paid", issuedAt: FieldValue.serverTimestamp() });
    });
    return res.json({ ok: true, status: "paid" });
  } catch (error) {
    console.error("verifyRazorpayPayment failed", error);
    return res.status(500).json({ error: "Payment verification failed" });
  }
}

async function webhook(req: Request, res: Response) {
  const signature = req.header("x-razorpay-signature") || "";
  const raw = JSON.stringify(req.body || {});
  if (!safeEqual(hmac(raw, required("RAZORPAY_WEBHOOK_SECRET")), signature)) return res.status(401).json({ error: "Invalid webhook signature" });
  return res.json({ received: true });
}

const app = express();
app.use(cors({ origin: true, methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "X-Razorpay-Signature"] }));
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.post("/createRazorpayOrderHttp", authenticate, createRazorpayOrder);
app.post("/verifyRazorpayPayment", authenticate, verifyPayment);
app.post("/razorpayWebhook", webhook);
app.get("/checkout", (req, res) => {
  const orderId = String(req.query.orderId || "");
  const keyId = String(req.query.keyId || "");
  const amount = String(req.query.amount || "");
  const currency = String(req.query.currency || "INR");
  const bookingId = String(req.query.bookingId || "");
  const token = String(req.query.token || "");
  if (!orderId || !keyId || !amount || !bookingId || !token) return res.status(400).send("Missing checkout details");
  const safe = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;", "'": "&#39;" } as Record<string, string>)[character] || character);
  res.type("html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cooperative Gig Payment</title><script src="https://checkout.razorpay.com/v1/checkout.js"></script><style>body{font-family:Arial,sans-serif;padding:32px;color:#102a43;text-align:center}button{background:#0f766e;color:#fff;border:0;border-radius:10px;padding:14px 24px;font-size:16px}</style></head><body><h2>Complete payment</h2><p>Booking: ${safe(bookingId)}</p><button id="pay">Pay now</button><p id="status"></p><script>const status=document.getElementById('status');document.getElementById('pay').onclick=()=>{const options={key:'${safe(keyId)}',amount:'${safe(amount)}',currency:'${safe(currency)}',name:'Cooperative Gig Services',description:'Booking ${safe(bookingId)}',order_id:'${safe(orderId)}',handler:async function(response){status.textContent='Verifying payment...';const result=await fetch('/verifyRazorpayPayment',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer ${safe(token)}'},body:JSON.stringify({...response,bookingId:'${safe(bookingId)}'})});status.textContent=result.ok?'Payment successful. You can close this window.':'Payment verification failed.'},modal:{ondismiss:()=>{status.textContent='Payment window closed.'}}};new Razorpay(options).open()};</script></body></html>`);
});
const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`Payment backend listening on ${port}`));

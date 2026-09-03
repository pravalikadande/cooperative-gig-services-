import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { firebaseAuth, firestore, firebaseStorage } from "./firebase";
import { isBookingContactEligible } from "./booking-lifecycle";
import type { AppUser, Booking, BookingStatus, ChatMessage, Complaint, Certification, CooperativeSociety, DemandForecast, Invoice, LanguageCode, PaymentRecord, Review, UserRole, WelfareRecord, WorkerKyc, WorkerProfile } from "./models";
import { buildWorkerDirectoryProfile, workerProfileFirestorePayload, type WorkerProfileDraftInput } from "./worker-directory";
import { bookingFirestorePayload, type BookingRequestInput } from "./booking-sync";

export async function readFirebaseUser(firebaseUser: User): Promise<AppUser | null> {
  if (!firestore) return null;
  const snapshot = await getDoc(doc(firestore, "users", firebaseUser.uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: firebaseUser.uid,
    name: typeof data.name === "string" ? data.name : firebaseUser.displayName || "Neighbour",
    email: typeof data.email === "string" ? data.email : firebaseUser.email || "",
    phone: typeof data.phone === "string" ? data.phone : undefined,
    address: typeof data.address === "string" ? data.address : undefined,
    role: data.role as UserRole,
    profileImage: typeof data.profileImage === "string" ? data.profileImage : undefined,
    location: data.location,
    federationId: typeof data.federationId === "string" ? data.federationId : undefined,
    societyId: typeof data.societyId === "string" ? data.societyId : undefined,
    language: data.language === "te" || data.language === "hi" ? data.language : "en",
    createdAt: data.createdAt?.toDate?.().toISOString?.() || new Date().toISOString(),
  };
}

export async function createFirebaseUserProfile(
  firebaseUser: User,
  input: { name?: string; role: UserRole },
): Promise<AppUser> {
  const nextUser: AppUser = {
    id: firebaseUser.uid,
    name: input.name?.trim() || firebaseUser.displayName || "Neighbour",
    email: firebaseUser.email || "",
    role: input.role,
    createdAt: new Date().toISOString(),
  };
  if (firestore) {
    await setDoc(
      doc(firestore, "users", firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        name: nextUser.name,
        email: nextUser.email,
        role: nextUser.role,
        profileImage: null,
        location: null,
        address: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return nextUser;
}

export async function updateFirebaseUserProfile(
  user: AppUser,
  input: { name?: string; phone?: string; address?: string; language?: LanguageCode; workerProfile?: Record<string, unknown> },
) {
  if (!firestore) return;
  await setDoc(
    doc(firestore, "users", user.id),
    {
      ...input,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  if (user.role === "worker") {
    await publishWorkerDirectoryProfile({
      ...user,
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.address !== undefined ? { address: input.address.trim() } : {}),
    }, input.workerProfile);
  }
}

function mapWorkerProfile(id: string, data: Record<string, unknown>): WorkerProfile {
  const profile = buildWorkerDirectoryProfile(
    {
      id: typeof data.userId === "string" ? data.userId : id,
      name: typeof data.name === "string" ? data.name : "Service partner",
      email: "",
      phone: typeof data.phone === "string" ? data.phone : undefined,
      role: "worker",
      profileImage: typeof data.profileImage === "string" ? data.profileImage : undefined,
      location: data.location as AppUser["location"],
      createdAt: timestampToIso(data.createdAt),
    },
    data,
    {
      id,
      userId: typeof data.userId === "string" ? data.userId : id,
      name: typeof data.name === "string" ? data.name : "Service partner",
      phone: typeof data.phone === "string" ? data.phone : undefined,
      profileImage: typeof data.profileImage === "string" ? data.profileImage : undefined,
      services: Array.isArray(data.services) ? data.services.filter((item): item is string => typeof item === "string") : [],
      skills: Array.isArray(data.skills) ? data.skills.filter((item): item is string => typeof item === "string") : [],
      experienceYears: typeof data.experienceYears === "number" ? data.experienceYears : 0,
      rating: typeof data.rating === "number" ? data.rating : 0,
      reviewCount: typeof data.reviewCount === "number" ? data.reviewCount : 0,
      location: data.location as WorkerProfile["location"],
      serviceArea: typeof data.serviceArea === "string" ? data.serviceArea : "",
      isOnline: typeof data.isOnline === "boolean" ? data.isOnline : true,
      isVerified: typeof data.isVerified === "boolean" ? data.isVerified : false,
      availability: typeof data.availability === "string" ? data.availability : "",
      startingPrice: typeof data.startingPrice === "number" ? data.startingPrice : 0,
      about: typeof data.about === "string" ? data.about : "",
    },
  );
  return {
    ...profile,
    federationId: typeof data.federationId === "string" ? data.federationId : undefined,
    societyId: typeof data.societyId === "string" ? data.societyId : undefined,
    verificationStatus: data.verificationStatus === "pending" || data.verificationStatus === "verified" || data.verificationStatus === "rejected" ? data.verificationStatus : "not_submitted",
    certificationIds: Array.isArray(data.certificationIds) ? data.certificationIds.filter((item): item is string => typeof item === "string") : [],
    isEmergencyAvailable: Boolean(data.isEmergencyAvailable),
  };
}

export async function publishWorkerDirectoryProfile(user: AppUser, draft?: WorkerProfileDraftInput) {
  const database = requireFirestore();
  const workerRef = doc(database, "workers", user.id);
  const existingSnapshot = await getDoc(workerRef);
  const existing = existingSnapshot.exists() ? mapWorkerProfile(workerRef.id, existingSnapshot.data()) : undefined;
  const profile = buildWorkerDirectoryProfile(user, draft, existing);
  await setDoc(workerRef, {
    ...workerProfileFirestorePayload(profile),
    workerId: user.id,
    userId: user.id,
    ...(existingSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return profile;
}

export async function setWorkerDirectoryOnline(user: AppUser, isOnline: boolean) {
  return publishWorkerDirectoryProfile(user, { isOnline });
}

export function subscribeToWorkerDirectory(onChange: (items: WorkerProfile[]) => void): Unsubscribe {
  const database = requireFirestore();
  return onSnapshot(collection(database, "workers"), (snapshot) => {
    onChange(snapshot.docs.map((item) => mapWorkerProfile(item.id, item.data())));
  });
}

function requireFirestore() {
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  return firestore;
}

function timestampToIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function mapBooking(id: string, data: Record<string, unknown>): Booking {
  return {
    id,
    customerId: String(data.customerId),
    customerName: typeof data.customerName === "string" ? data.customerName : undefined,
    customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : undefined,
    workerId: String(data.workerId),
    workerName: typeof data.workerName === "string" ? data.workerName : undefined,
    workerPhone: typeof data.workerPhone === "string" ? data.workerPhone : undefined,
    serviceId: String(data.serviceId),
    serviceName: String(data.serviceName),
    date: String(data.date),
    time: String(data.time),
    location: data.location as Booking["location"],
    description: String(data.description ?? ""),
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    price: Number(data.price),
    priority: data.priority === "emergency" || data.priority === "on_demand" ? data.priority : "standard",
    paymentStatus: data.paymentStatus === "pending" || data.paymentStatus === "paid" || data.paymentStatus === "refunded" || data.paymentStatus === "failed" ? data.paymentStatus : "unpaid",
    paymentId: typeof data.paymentId === "string" ? data.paymentId : undefined,
    invoiceId: typeof data.invoiceId === "string" ? data.invoiceId : undefined,
    status: data.status as BookingStatus,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function createBooking(input: BookingRequestInput) {
  const database = requireFirestore();
  const bookingRef = doc(collection(database, "bookings"));
  await setDoc(bookingRef, {
    ...bookingFirestorePayload(input),
    bookingId: bookingRef.id,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(database, "chats", bookingRef.id), {
    bookingId: bookingRef.id,
    customerId: input.customerId,
    workerId: input.workerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return bookingRef.id;
}

export function subscribeToBookings(userId: string, role: UserRole, onChange: (items: Booking[]) => void): Unsubscribe {
  const database = requireFirestore();
  const field = role === "worker" ? "workerId" : "customerId";
  const bookingsQuery = query(collection(database, "bookings"), where(field, "==", userId));
  return onSnapshot(bookingsQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => mapBooking(item.id, item.data()));
    items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    onChange(items);
  });
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const database = requireFirestore();
  await updateDoc(doc(database, "bookings", bookingId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToMessages(chatId: string, onChange: (items: ChatMessage[]) => void): Unsubscribe {
  const database = requireFirestore();
  const messagesQuery = query(collection(database, "chats", chatId, "messages"), orderBy("timestamp", "asc"), limit(200));
  return onSnapshot(messagesQuery, (snapshot) => onChange(snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      chatId,
      senderId: String(data.senderId),
      receiverId: String(data.receiverId),
      message: String(data.message),
      timestamp: data.timestamp?.toDate?.().toISOString?.() || "",
      isRead: Boolean(data.isRead),
    };
  })));
}

export async function sendBookingMessage(input: Omit<ChatMessage, "id" | "timestamp" | "isRead"> & { bookingStatus: BookingStatus }) {
  if (!isBookingContactEligible(input.bookingStatus)) {
    throw new Error("Messaging is available only for an accepted, confirmed, or active booking.");
  }
  const database = requireFirestore();
  await addDoc(collection(database, "chats", input.chatId, "messages"), {
    senderId: input.senderId,
    receiverId: input.receiverId,
    message: input.message.trim(),
    timestamp: serverTimestamp(),
    isRead: false,
  });
  await updateDoc(doc(database, "chats", input.chatId), { updatedAt: serverTimestamp() });
}

export async function submitReview(input: Omit<Review, "id" | "createdAt">) {
  const database = requireFirestore();
  if (!input.bookingId || !input.customerId || !input.workerId) throw new Error("Review details are incomplete.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Choose a rating from one to five stars.");
  const bookingSnapshot = await getDoc(doc(database, "bookings", input.bookingId));
  if (!bookingSnapshot.exists()) throw new Error("This booking could not be found.");
  const booking = bookingSnapshot.data();
  if (booking.customerId !== input.customerId) throw new Error("Only the customer who made the booking can review it.");
  if (booking.status !== "completed") throw new Error("Reviews are available after the service is completed.");
  const reviewRef = doc(database, "reviews", input.bookingId);
  const existing = await getDoc(reviewRef);
  if (existing.exists()) throw new Error("A review has already been submitted for this booking.");
  await setDoc(reviewRef, { ...input, comment: input.comment?.trim() || "", createdAt: serverTimestamp() });
}

export async function uploadImage(uri: string, path: `profileImages/${string}` | `bookingImages/${string}`) {
  if (!firebaseStorage) throw new Error("Firebase Storage is not enabled for this project.");
  const response = await fetch(uri);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
  if (blob.size > 5 * 1024 * 1024) throw new Error("Image must be 5 MB or smaller.");
  const storageRef = ref(firebaseStorage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  return getDownloadURL(storageRef);
}


export async function saveCertification(input: Omit<Certification, "id">) {
  const database = requireFirestore();
  const certificationRef = doc(collection(database, "certifications"));
  await setDoc(certificationRef, { ...input, certificationId: certificationRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return certificationRef.id;
}

export function subscribeToCertifications(workerId: string, onChange: (items: Certification[]) => void): Unsubscribe {
  const database = requireFirestore();
  const certificationsQuery = query(collection(database, "certifications"), where("workerId", "==", workerId));
  return onSnapshot(certificationsQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Certification, "id">) }))));
}

export async function saveWelfareRecord(input: Omit<WelfareRecord, "id">) {
  const database = requireFirestore();
  const recordRef = doc(collection(database, "welfareRecords"));
  await setDoc(recordRef, { ...input, welfareRecordId: recordRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return recordRef.id;
}

export function subscribeToWelfareRecords(workerId: string, onChange: (items: WelfareRecord[]) => void): Unsubscribe {
  const database = requireFirestore();
  const welfareQuery = query(collection(database, "welfareRecords"), where("workerId", "==", workerId));
  return onSnapshot(welfareQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<WelfareRecord, "id">) }))));
}

export async function createComplaint(input: Omit<Complaint, "id" | "createdAt" | "status">) {
  const database = requireFirestore();
  const complaintRef = doc(collection(database, "complaints"));
  await setDoc(complaintRef, { ...input, complaintId: complaintRef.id, status: "open", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return complaintRef.id;
}

export type PaymentOrderResponse = {
  keyId: string;
  orderId: string;
  paymentRecordId: string;
  amount: number;
  currency: string;
};

/**
 * Starts a gateway order. The server reads the booking amount and creates the
 * payment record; the client never writes payment status or invoice fields.
 */
export async function createPaymentAttempt(input: Pick<PaymentRecord, "bookingId" | "customerId" | "workerId" | "amount" | "gateway">): Promise<string> {
  const endpoint = process.env.EXPO_PUBLIC_CREATE_PAYMENT_ORDER_URL;
  const currentUser = firebaseAuth?.currentUser;
  if (!endpoint) throw new Error("Payment service URL is not configured.");
  if (!currentUser) throw new Error("Please sign in before starting payment.");

  const idToken = await currentUser.getIdToken();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId: input.bookingId }),
  });
  const body = await response.json().catch(() => ({})) as Partial<PaymentOrderResponse> & { error?: string };
  if (!response.ok || typeof body.paymentRecordId !== "string") {
    throw new Error(body.error || "Could not create payment order.");
  }
  return body.paymentRecordId;
}

export function subscribeToPayments(userId: string, role: "customer" | "worker", onChange: (items: PaymentRecord[]) => void): Unsubscribe {
  const database = requireFirestore();
  const paymentsQuery = query(collection(database, "payments"), where(role === "customer" ? "customerId" : "workerId", "==", userId));
  return onSnapshot(paymentsQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<PaymentRecord, "id">) }))));
}

export function subscribeToInvoices(userId: string, role: "customer" | "worker", onChange: (items: Invoice[]) => void): Unsubscribe {
  const database = requireFirestore();
  const invoicesQuery = query(collection(database, "invoices"), where(role === "customer" ? "customerId" : "workerId", "==", userId));
  return onSnapshot(invoicesQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Invoice, "id">) }))));
}

export function subscribeToSocieties(federationId: string, onChange: (items: CooperativeSociety[]) => void): Unsubscribe {
  const database = requireFirestore();
  const societiesQuery = query(collection(database, "societies"), where("federationId", "==", federationId));
  return onSnapshot(societiesQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CooperativeSociety, "id">) }))));
}

export async function createCooperativeSociety(input: Omit<CooperativeSociety, "id">) {
  const database = requireFirestore();
  const societyRef = doc(collection(database, "societies"));
  await setDoc(societyRef, { ...input, societyId: societyRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return societyRef.id;
}

export async function saveDemandForecast(input: Omit<DemandForecast, "id" | "generatedAt">) {
  const database = requireFirestore();
  const forecastRef = doc(collection(database, "demandForecasts"));
  await setDoc(forecastRef, { ...input, forecastId: forecastRef.id, generatedAt: serverTimestamp() });
  return forecastRef.id;
}

export function subscribeToDemandForecasts(area: string, onChange: (items: DemandForecast[]) => void): Unsubscribe {
  const database = requireFirestore();
  const forecastsQuery = query(collection(database, "demandForecasts"), where("area", "==", area), orderBy("generatedAt", "desc"), limit(50));
  return onSnapshot(forecastsQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<DemandForecast, "id">) }))));
}


export async function uploadVerificationDocument(uri: string, path: `verificationDocuments/${string}`) {
  if (!firebaseStorage) throw new Error("Firebase Storage is not enabled for this project.");
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The selected document could not be read.");
  const blob = await response.blob();
  const contentType = blob.type || "application/octet-stream";
  const allowed = contentType === "application/pdf" || contentType.startsWith("image/");
  if (!allowed) throw new Error("Upload a PDF or image document.");
  const storageRef = ref(firebaseStorage, path);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}


export function subscribeToAllBookings(onChange: (items: Booking[]) => void): Unsubscribe {
  const database = requireFirestore();
  return onSnapshot(collection(database, "bookings"), (snapshot) => {
    const items = snapshot.docs.map((item) => mapBooking(item.id, item.data()));
    items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    onChange(items);
  });
}

export function subscribeToComplaints(onChange: (items: Complaint[]) => void): Unsubscribe {
  const database = requireFirestore();
  return onSnapshot(collection(database, "complaints"), (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Complaint, "id">) }));
    items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    onChange(items);
  });
}

export function subscribeToUserDirectory(onChange: (items: AppUser[]) => void): Unsubscribe {
  const database = requireFirestore();
  return onSnapshot(collection(database, "users"), (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: typeof data.name === "string" ? data.name : "Neighbour",
        email: typeof data.email === "string" ? data.email : "",
        phone: typeof data.phone === "string" ? data.phone : undefined,
        address: typeof data.address === "string" ? data.address : undefined,
        role: data.role as UserRole,
        profileImage: typeof data.profileImage === "string" ? data.profileImage : undefined,
        location: data.location,
        federationId: typeof data.federationId === "string" ? data.federationId : undefined,
        societyId: typeof data.societyId === "string" ? data.societyId : undefined,
        language: data.language === "te" || data.language === "hi" ? data.language : "en",
        createdAt: data.createdAt?.toDate?.().toISOString?.() || new Date().toISOString(),
      } satisfies AppUser;
    });
    onChange(items);
  });
}


export async function updateWorkerVerification(workerId: string, status: "verified" | "rejected") {
  const database = requireFirestore();
  await updateDoc(doc(database, "workers", workerId), {
    verificationStatus: status,
    isVerified: status === "verified",
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(database, "users", workerId), { verificationStatus: status, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateComplaintStatus(complaintId: string, status: Complaint["status"]) {
  const database = requireFirestore();
  await updateDoc(doc(database, "complaints", complaintId), { status, updatedAt: serverTimestamp() });
}


export type AdminData = {
  workers: WorkerProfile[];
  users: AppUser[];
  bookings: Booking[];
};

function mapWorkerKyc(id: string, data: Record<string, unknown>): WorkerKyc {
  const status = data.status === "approved" || data.status === "needs_resubmission" || data.status === "rejected" ? data.status : data.status === "pending" ? "pending" : "not_submitted";
  return {
    workerId: typeof data.workerId === "string" ? data.workerId : id,
    idType: typeof data.idType === "string" ? data.idType : undefined,
    idNumberLast4: typeof data.idNumberLast4 === "string" ? data.idNumberLast4 : undefined,
    idDocumentUrl: typeof data.idDocumentUrl === "string" ? data.idDocumentUrl : undefined,
    selfieUrl: typeof data.selfieUrl === "string" ? data.selfieUrl : undefined,
    status,
    submittedAt: timestampToIso(data.submittedAt),
    reviewedAt: timestampToIso(data.reviewedAt),
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
    reviewNote: typeof data.reviewNote === "string" ? data.reviewNote : undefined,
  };
}

export async function uploadKycDocument(uri: string, workerId: string, kind: "id" | "selfie", mimeType?: string) {
  if (!firebaseStorage) throw new Error("Firebase Storage is not enabled for this project.");
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The selected document could not be read.");
  const blob = await response.blob();
  const contentType = mimeType || blob.type || "application/octet-stream";
  if (!(contentType === "application/pdf" || contentType.startsWith("image/"))) throw new Error("Upload a PDF or image document.");
  const extension = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] || "jpg";
  const storageRef = ref(firebaseStorage, `kyc/${workerId}/${kind}.${extension}`);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

export async function saveWorkerKyc(input: Omit<WorkerKyc, "status" | "submittedAt">) {
  const database = requireFirestore();
  await setDoc(doc(database, "workerKyc", input.workerId), { ...input, status: "pending", submittedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToWorkerKyc(workerId: string, onChange: (item: WorkerKyc | null) => void): Unsubscribe {
  const database = requireFirestore();
  return onSnapshot(doc(database, "workerKyc", workerId), (snapshot) => onChange(snapshot.exists() ? mapWorkerKyc(snapshot.id, snapshot.data()) : null));
}

export function subscribeToAllWorkerKyc(onChange: (items: WorkerKyc[]) => void): Unsubscribe {
  const database = requireFirestore();
  return onSnapshot(collection(database, "workerKyc"), (snapshot) => onChange(snapshot.docs.map((item) => mapWorkerKyc(item.id, item.data()))));
}

export async function reviewWorkerKyc(workerId: string, status: "approved" | "needs_resubmission", reviewer: string, reviewNote?: string) {
  const database = requireFirestore();
  await updateDoc(doc(database, "workerKyc", workerId), { status, reviewedBy: reviewer, reviewNote: reviewNote || null, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (status === "approved") await updateWorkerVerification(workerId, "verified");
}

export function subscribeToAdminData(onChange: (data: AdminData) => void): Unsubscribe {
  const database = requireFirestore();
  let users: AppUser[] = [];
  let workers: WorkerProfile[] = [];
  let bookings: Booking[] = [];
  const emit = () => onChange({ users, workers, bookings });
  const unsubUsers = subscribeToUserDirectory((items) => { users = items; emit(); });
  const unsubWorkers = subscribeToWorkerDirectory((items) => { workers = items; emit(); });
  const unsubBookings = subscribeToAllBookings((items) => { bookings = items; emit(); });
  return () => { unsubUsers(); unsubWorkers(); unsubBookings(); };
}

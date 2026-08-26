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

import { firestore, firebaseStorage } from "./firebase";
import { isBookingContactEligible } from "./booking-lifecycle";
import type { AppUser, Booking, BookingStatus, ChatMessage, Review, UserRole, WorkerProfile } from "./models";
import { buildWorkerDirectoryProfile, workerProfileFirestorePayload, type WorkerProfileDraftInput } from "./worker-directory";

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
  input: { name?: string; phone?: string; address?: string; workerProfile?: Record<string, unknown> },
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
  return buildWorkerDirectoryProfile(
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
    workerId: String(data.workerId),
    serviceId: String(data.serviceId),
    serviceName: String(data.serviceName),
    date: String(data.date),
    time: String(data.time),
    location: data.location as Booking["location"],
    description: String(data.description ?? ""),
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    price: Number(data.price),
    status: data.status as BookingStatus,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function createBooking(input: Omit<Booking, "id" | "status" | "createdAt" | "updatedAt">) {
  const database = requireFirestore();
  const bookingRef = doc(collection(database, "bookings"));
  await setDoc(bookingRef, {
    ...input,
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
  const bookingsQuery = query(collection(database, "bookings"), where(field, "==", userId), orderBy("updatedAt", "desc"));
  return onSnapshot(bookingsQuery, (snapshot) => onChange(snapshot.docs.map((item) => mapBooking(item.id, item.data()))));
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
  await setDoc(doc(database, "reviews", input.bookingId), {
    ...input,
    createdAt: serverTimestamp(),
  });
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

export const USER_ROLES = ["customer", "worker", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VERIFICATION_STATUSES = ["not_submitted", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BOOKING_PRIORITIES = ["standard", "on_demand", "emergency"] as const;
export type BookingPriority = (typeof BOOKING_PRIORITIES)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_METHODS = ["razorpay", "upi", "offline", "card", "netbanking", "wallet", "cash_on_service"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LANGUAGE_CODES = ["en", "te", "hi", "mr", "ta", "bn"] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type ServiceCategory = {
  id: string;
  name: string;
  icon: "plumbing" | "bolt" | "cleaning-services" | "directions-car" | "handyman";
  description: string;
  startingPrice: number;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: UserRole;
  profileImage?: string;
  location?: Coordinate;
  federationId?: string;
  societyId?: string;
  language?: LanguageCode;
  createdAt: string;
};

export type WorkerProfile = {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  profileImage?: string;
  services: string[];
  skills: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  location?: Coordinate;
  serviceArea: string;
  isOnline: boolean;
  isVerified: boolean;
  availability: string;
  startingPrice: number;
  about: string;
  federationId?: string;
  societyId?: string;
  verificationStatus?: VerificationStatus;
  certificationIds?: string[];
  isEmergencyAvailable?: boolean;
};

export type BookingLocation = Coordinate & {
  address: string;
};

export type Booking = {
  id: string;
  customerId: string;
  customerName?: string;
  /** Private participant contact snapshot; booking access is restricted to its participants. */
  customerPhone?: string;
  workerId: string;
  workerName?: string;
  /** Private participant contact snapshot; booking access is restricted to its participants. */
  workerPhone?: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  location: BookingLocation;
  description: string;
  imageUrl?: string;
  price: number;
  priority?: BookingPriority;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentId?: string;
  invoiceId?: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
};

export type Certification = {
  id: string;
  workerId: string;
  title: string;
  issuingBody: string;
  issuedOn?: string;
  expiresOn?: string;
  documentUrl?: string;
  status: VerificationStatus;
};

export type WelfareRecord = {
  id: string;
  workerId: string;
  type: "insurance" | "benefit" | "safety_training";
  provider?: string;
  policyNumber?: string;
  coverageStart?: string;
  coverageEnd?: string;
  status: "active" | "expired" | "pending";
};

export type CooperativeSociety = {
  id: string;
  federationId: string;
  name: string;
  district: string;
  isActive: boolean;
};

export type Invoice = {
  id: string;
  bookingId: string;
  customerId: string;
  workerId: string;
  subtotal: number;
  cooperativeFee: number;
  total: number;
  status: PaymentStatus;
  issuedAt: string;
};

export type PaymentRecord = {
  id: string;
  bookingId: string;
  customerId: string;
  workerId: string;
  amount: number;
  cooperativeFee: number;
  workerPayout: number;
  gateway: "razorpay" | "upi" | "offline";
  status: PaymentStatus;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Complaint = {
  id: string;
  bookingId?: string;
  reporterId: string;
  againstUserId?: string;
  category: "service_quality" | "safety" | "payment" | "other";
  description: string;
  status: "open" | "under_review" | "resolved" | "rejected";
  createdAt: string;
};

export type DemandForecast = {
  id: string;
  serviceId: string;
  area: string;
  period: string;
  predictedJobs: number;
  recommendedWorkerIds: string[];
  confidence: number;
  generatedAt: string;
  source: "rules" | "ai";
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
};

export type Review = {
  id: string;
  bookingId: string;
  customerId: string;
  workerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
};

export type WorkerKyc = {
  workerId: string;
  idType?: string;
  idNumberLast4?: string;
  idDocumentUrl?: string;
  selfieUrl?: string;
  status: "not_submitted" | "pending" | "approved" | "needs_resubmission" | "rejected";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  rejectionReason?: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  bookingId?: string;
  isRead: boolean;
  createdAt: string;
};

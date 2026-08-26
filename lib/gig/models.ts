export const USER_ROLES = ["customer", "worker", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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
};

export type BookingLocation = Coordinate & {
  address: string;
};

export type Booking = {
  id: string;
  customerId: string;
  customerName?: string;
  workerId: string;
  workerName?: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  location: BookingLocation;
  description: string;
  imageUrl?: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
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

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  bookingId?: string;
  isRead: boolean;
  createdAt: string;
};

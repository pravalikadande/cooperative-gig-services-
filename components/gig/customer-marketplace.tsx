import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { isBookingContactEligible, bookingStatusLabel, canLeaveReview } from "@/lib/gig/booking-lifecycle";
import { createBooking, createComplaint, createPaymentAttempt, sendBookingMessage, subscribeToBookings, subscribeToInvoices, subscribeToMessages, subscribeToWorkerDirectory } from "@/lib/gig/firebase-repository";
import { requestCurrentServiceLocation } from "@/lib/gig/location";
import { LANGUAGE_OPTIONS } from "@/lib/gig/i18n";
import type { AppUser, Booking, BookingPriority, BookingStatus, ChatMessage, Coordinate, Invoice, LanguageCode, PaymentStatus, ServiceCategory, WorkerProfile } from "@/lib/gig/models";
import { ServiceMap } from "@/components/gig/service-map";

type CustomerView = "home" | "explore" | "worker" | "booking" | "confirmation" | "bookings" | "review" | "profile" | "chat" | "support" | "payment" | "invoices";
type WorkerFilter = "All" | "Online now" | "Verified" | "Top rated" | "Emergency ready";
type CustomerProfileDraft = { name: string; phone: string; address: string; notificationsEnabled: boolean; language: LanguageCode };
type SelectedLocation = { label: string; latitude: number; longitude: number };

const PREFERRED_LOCATION_KEY = "cooperative-gig-services/preferred-location";
const manualLocations: SelectedLocation[] = [
  { label: "Hyderabad", latitude: 17.385, longitude: 78.4867 },
  { label: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
  { label: "Mumbai", latitude: 19.076, longitude: 72.8777 },
  { label: "Chennai", latitude: 13.0827, longitude: 80.2707 },
  { label: "New Delhi", latitude: 28.6139, longitude: 77.209 },
];

const services: ServiceCategory[] = [
  { id: "plumbing", name: "Plumber", icon: "plumbing", description: "Leaks, fittings & repairs", startingPrice: 299 },
  { id: "electric", name: "Electrician", icon: "bolt", description: "Safe home electrical work", startingPrice: 349 },
  { id: "cleaning", name: "Cleaner", icon: "cleaning-services", description: "Home & deep cleaning", startingPrice: 399 },
  { id: "driver", name: "Driver", icon: "directions-car", description: "Local rides & delivery help", startingPrice: 249 },
];

const workers: WorkerProfile[] = [
  { id: "worker-raj", userId: "worker-raj", name: "Rajesh Kumar", services: ["Plumber", "Handyman"], skills: ["Pipe repair", "Bathroom fitting", "Leak detection"], experienceYears: 8, rating: 4.9, reviewCount: 128, serviceArea: "Banjara Hills & nearby", isOnline: true, isVerified: true, availability: "Available today, 10:00 AM – 7:00 PM", startingPrice: 299, about: "Experienced cooperative plumber focused on clean, transparent work and dependable follow-up." },
  { id: "worker-ananya", userId: "worker-ananya", name: "Ananya Reddy", services: ["Electrician"], skills: ["Wiring", "Switchboards", "Appliance installation"], experienceYears: 6, rating: 4.8, reviewCount: 96, serviceArea: "Jubilee Hills & nearby", isOnline: true, isVerified: true, availability: "Available today, 11:00 AM – 6:00 PM", startingPrice: 349, about: "Certified electrician providing safe residential repairs and installations with clear upfront estimates." },
  { id: "worker-salma", userId: "worker-salma", name: "Salma Begum", services: ["Cleaner"], skills: ["Deep clean", "Kitchen care", "Move-in cleaning"], experienceYears: 5, rating: 4.9, reviewCount: 84, serviceArea: "Madhapur & nearby", isOnline: false, isVerified: true, availability: "Next slot: Tomorrow, 9:30 AM", startingPrice: 399, about: "Detail-oriented home cleaning specialist and active member of the neighbourhood services cooperative." },
];

const seedBookings = [
  { id: "CGS-24058", worker: "Rajesh Kumar", service: "Plumber", date: "Today", time: "4:30 PM", status: "confirmed" as BookingStatus, price: 299 },
  { id: "CGS-23901", worker: "Salma Begum", service: "Cleaner", date: "12 Aug", time: "10:00 AM", status: "completed" as BookingStatus, price: 699 },
];

export function CustomerMarketplace({ user, onSaveProfile, onSignOut }: { user: AppUser; onSaveProfile: (input: { name?: string; phone?: string; address?: string; language?: LanguageCode }) => Promise<void>; onSignOut: () => Promise<void> }) {
  const name = user.name;
  const [view, setView] = useState<CustomerView>("home");
  const [localHour, setLocalHour] = useState(() => new Date().getHours());
  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceCategory>(services[0]);
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<BookingPriority>("standard");
  const [bookingDate, setBookingDate] = useState("Tomorrow");
  const [bookingTime, setBookingTime] = useState("11:00 AM");
  const [selectedWorker, setSelectedWorker] = useState<WorkerProfile>(workers[0]);
  const [draftDescription, setDraftDescription] = useState("");
  const [createdBooking, setCreatedBooking] = useState<{ id: string; status: BookingStatus; date: string; time: string } | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [serviceLocation, setServiceLocation] = useState({ latitude: 17.4486, longitude: 78.3908, label: "Madhapur, Hyderabad" });
  const [headerLocation, setHeaderLocation] = useState<SelectedLocation>({ label: "Finding location…", latitude: 17.4486, longitude: 78.3908 });
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [bookingImageUri, setBookingImageUri] = useState<string | null>(null);
  const [activeWorkerFilter, setActiveWorkerFilter] = useState<WorkerFilter>("All");
  const [liveWorkers, setLiveWorkers] = useState<WorkerProfile[] | null>(null);
  const [liveBookings, setLiveBookings] = useState<Booking[] | null>(null);
  const [liveInvoices, setLiveInvoices] = useState<Invoice[] | null>(null);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [activeCustomerChat, setActiveCustomerChat] = useState<Booking | null>(null);
  const [activePaymentBooking, setActivePaymentBooking] = useState<Booking | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState<"service_quality" | "safety" | "payment" | "other">("service_quality");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [isComplaintSubmitting, setIsComplaintSubmitting] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileDraft>({ name, phone: user.phone ?? "", address: user.address ?? "Madhapur, Hyderabad", notificationsEnabled: true, language: user.language ?? "en" });
  const directoryWorkers = useMemo(() => {
    if (!liveWorkers?.length) return workers;
    const liveIds = new Set(liveWorkers.map((worker) => worker.userId));
    return [...liveWorkers, ...workers.filter((worker) => !liveIds.has(worker.userId))];
  }, [liveWorkers]);
  const filteredWorkers = useMemo(() => directoryWorkers.filter((worker) => {
    const matchesSearch = `${worker.name} ${worker.services.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesService = !serviceFilter || worker.services.some((service) => service.toLowerCase().includes(serviceFilter.toLowerCase()));
    const matchesFilter = activeWorkerFilter === "All"
      || (activeWorkerFilter === "Online now" && worker.isOnline)
      || (activeWorkerFilter === "Verified" && worker.isVerified)
      || (activeWorkerFilter === "Top rated" && worker.rating >= 4.8)
      || (activeWorkerFilter === "Emergency ready" && worker.isEmergencyAvailable);
    return matchesSearch && matchesService && matchesFilter;
  }).sort((left, right) => {
    const leftDistance = left.location ? distanceInKm(serviceLocation, left.location) : Number.POSITIVE_INFINITY;
    const rightDistance = right.location ? distanceInKm(serviceLocation, right.location) : Number.POSITIVE_INFINITY;
    return leftDistance - rightDistance;
  }), [activeWorkerFilter, directoryWorkers, query, serviceFilter, serviceLocation]);

  const applyLocation = (location: SelectedLocation, persist = false) => {
    setHeaderLocation(location);
    setServiceLocation(location);
    if (persist) AsyncStorage.setItem(PREFERRED_LOCATION_KEY, JSON.stringify(location)).catch(() => undefined);
  };

  const detectCurrentLocation = async (silent = false) => {
    try {
      const result = await requestCurrentServiceLocation();
      if (!result.ok) {
        if (!silent) Alert.alert("Location unavailable", result.message);
        return;
      }
      applyLocation({ label: result.label, latitude: result.latitude, longitude: result.longitude });
      await AsyncStorage.removeItem(PREFERRED_LOCATION_KEY);
    } catch {
      if (!silent) Alert.alert("Location unavailable", "We could not read your current location. Choose a city manually instead.");
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(PREFERRED_LOCATION_KEY)
      .then((value) => {
        if (value) {
          const saved = JSON.parse(value) as SelectedLocation;
          if (saved.label && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) {
            applyLocation(saved);
            return;
          }
        }
        return detectCurrentLocation(true);
      })
      .catch(() => detectCurrentLocation(true));
  }, []);

  useEffect(() => {
    const updateHour = () => setLocalHour(new Date().getHours());
    const interval = setInterval(updateHour, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      return subscribeToWorkerDirectory(setLiveWorkers);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    try {
      return subscribeToBookings(user.id, "customer", setLiveBookings);
    } catch {
      return undefined;
    }
  }, [user.id]);

  useEffect(() => {
    try {
      return subscribeToInvoices(user.id, "customer", setLiveInvoices);
    } catch {
      return undefined;
    }
  }, [user.id]);

  const timeGreeting = localHour < 12 ? "Good morning" : localHour < 17 ? "Good afternoon" : "Good evening";

  const openWorker = (worker: WorkerProfile) => {
    setSelectedWorker(worker);
    const matching = services.find((service) => worker.services.includes(service.name));
    if (matching) setSelectedService(matching);
    setView("worker");
  };

  const confirmBooking = async () => {
    if (isBookingSubmitting) return;
    setIsBookingSubmitting(true);
    try {
      const id = await createBooking({
        customerId: user.id,
        customerName: user.name,
        customerPhone: user.phone?.trim() || undefined,
        workerId: selectedWorker.userId,
        workerName: selectedWorker.name,
        workerPhone: selectedWorker.phone?.trim() || undefined,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        date: bookingDate,
        time: selectedPriority === "emergency" ? "As soon as possible" : bookingTime,
        location: { latitude: serviceLocation.latitude, longitude: serviceLocation.longitude, address: serviceLocation.label },
        description: draftDescription.trim(),
        price: selectedService.startingPrice,
        priority: selectedPriority,
        paymentStatus: "unpaid",
      });
      setCreatedBooking({ id, status: "pending", date: bookingDate, time: selectedPriority === "emergency" ? "As soon as possible" : bookingTime });
      setView("confirmation");
    } catch (error) {
      Alert.alert("Booking not sent", error instanceof Error ? error.message : "We could not create this booking. Please try again.");
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const openTab = (next: CustomerView) => setView(next);
  const useCurrentLocation = () => detectCurrentLocation();
  const chooseBookingImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.72,
    });
    if (!result.canceled) setBookingImageUri(result.assets[0].uri);
  };
  const submitPaymentRequest = async (gateway: "razorpay" | "upi") => {
    if (!activePaymentBooking || isPaymentSubmitting) return;
    setIsPaymentSubmitting(true);
    try {
      await createPaymentAttempt({ bookingId: activePaymentBooking.id, customerId: user.id, workerId: activePaymentBooking.workerId, amount: activePaymentBooking.price, gateway });
      setActivePaymentBooking(null);
      setView("bookings");
      Alert.alert("Payment request created", "Your secure payment request is recorded. The cooperative will confirm the gateway payment and issue the invoice.");
    } catch (error) {
      Alert.alert("Payment not started", error instanceof Error ? error.message : "Please try again after the worker accepts your booking.");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };
  const submitComplaint = async () => {
    if (!complaintDescription.trim() || isComplaintSubmitting) return;
    setIsComplaintSubmitting(true);
    try {
      await createComplaint({ reporterId: user.id, bookingId: liveBookings?.find((booking) => isBookingContactEligible(booking.status))?.id, category: complaintCategory, description: complaintDescription.trim() });
      setComplaintDescription("");
      setView("profile");
      Alert.alert("Report submitted", "The cooperative support team will review your report and contact you through the booking channel.");
    } catch (error) {
      Alert.alert("Report not submitted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsComplaintSubmitting(false);
    }
  };
  const saveCustomerProfile = async () => {
    await onSaveProfile({ name: customerProfile.name, phone: customerProfile.phone, address: customerProfile.address, language: customerProfile.language });
  };
  const activeTab = view === "bookings" ? "Bookings" : view === "profile" ? "Profile" : view === "explore" ? "Explore" : "Home";

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <View style={styles.logoSmall}><MaterialIcons name="handshake" size={19} color="#FFFFFF" /></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose service location" activeOpacity={0.72} onPress={() => setIsLocationPickerOpen((open) => !open)} style={styles.location}><MaterialIcons name="location-on" size={17} color="#0F766E" /><Text numberOfLines={1} style={styles.locationText}>{headerLocation.label}</Text><MaterialIcons name={isLocationPickerOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={17} color="#627D98" /></TouchableOpacity>
        <Pressable onPress={() => Alert.alert("Notifications", "No new service updates yet.")} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}><MaterialIcons name="notifications-none" size={22} color="#102A43" /></Pressable>
      </View>
      {isLocationPickerOpen && <View style={styles.locationPicker}><Text style={styles.locationPickerTitle}>Service location</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Use my current location" activeOpacity={0.72} onPress={() => { setIsLocationPickerOpen(false); detectCurrentLocation(); }} style={styles.locationCurrentRow}><MaterialIcons name="my-location" size={19} color="#0F766E" /><View style={styles.flex}><Text style={styles.locationCurrentTitle}>Use my current location</Text><Text style={styles.locationCurrentCopy}>Ask device permission and update nearby services</Text></View></TouchableOpacity><Text style={styles.locationPickerHint}>Or choose a city manually</Text><View style={styles.locationOptions}>{manualLocations.map((location) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Choose ${location.label}`} activeOpacity={0.72} key={location.label} onPress={() => { applyLocation(location, true); setIsLocationPickerOpen(false); }} style={[styles.locationOption, headerLocation.label === location.label && styles.locationOptionActive]}><Text style={[styles.locationOptionText, headerLocation.label === location.label && styles.locationOptionTextActive]}>{location.label}</Text></TouchableOpacity>)}</View></View>}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {view === "home" && <HomeView greeting={timeGreeting} name={customerProfile.name || name} selectedService={selectedService} setSelectedService={setSelectedService} workers={directoryWorkers} customerLocation={serviceLocation} onExplore={() => setView("explore")} onWorker={openWorker} />}
        {view === "explore" && <ExploreView query={query} setQuery={setQuery} selectedService={selectedService} serviceFilter={serviceFilter} setServiceFilter={setServiceFilter} activeFilter={activeWorkerFilter} setActiveFilter={setActiveWorkerFilter} workers={filteredWorkers} customerLocation={serviceLocation} onWorker={openWorker} />}
        {view === "worker" && <WorkerView worker={selectedWorker} onBack={() => setView("explore")} onBook={() => setView("booking")} />}
        {view === "booking" && <BookingView worker={selectedWorker} service={selectedService} priority={selectedPriority} setPriority={setSelectedPriority} bookingDate={bookingDate} setBookingDate={setBookingDate} bookingTime={bookingTime} setBookingTime={setBookingTime} description={draftDescription} setDescription={setDraftDescription} serviceLocation={serviceLocation} onUseCurrentLocation={useCurrentLocation} bookingImageUri={bookingImageUri} onChooseImage={chooseBookingImage} onBack={() => setView("worker")} onConfirm={() => { void confirmBooking(); }} isSubmitting={isBookingSubmitting} />}
        {view === "confirmation" && createdBooking && <ConfirmationView booking={createdBooking} worker={selectedWorker} service={selectedService} onBookings={() => setView("bookings")} />}
        {view === "bookings" && <BookingsView createdBooking={createdBooking} liveBookings={liveBookings} selectedWorker={selectedWorker} selectedService={selectedService} availableWorkers={directoryWorkers} onWorker={openWorker} onMessage={(booking) => { setActiveCustomerChat(booking); setView("chat"); }} onCall={(booking) => { void openBookingCall(booking.workerPhone ?? directoryWorkers.find((worker) => worker.userId === booking.workerId)?.phone); }} onPay={(booking) => { setActivePaymentBooking(booking); setView("payment"); }} hasReviewed={hasReviewed} onReview={() => setView("review")} />}
        {view === "chat" && activeCustomerChat && <CustomerConversation booking={activeCustomerChat} user={user} onBack={() => setView("bookings")} />}
        {view === "support" && <ComplaintView category={complaintCategory} setCategory={setComplaintCategory} description={complaintDescription} setDescription={setComplaintDescription} isSubmitting={isComplaintSubmitting} onSubmit={() => { void submitComplaint(); }} onBack={() => setView("profile")} />}
        {view === "invoices" && <InvoicesView invoices={liveInvoices} onBack={() => setView("profile")} />}
        {view === "payment" && activePaymentBooking && <PaymentView booking={activePaymentBooking} isSubmitting={isPaymentSubmitting} onSubmit={(gateway) => { void submitPaymentRequest(gateway); }} onBack={() => { setActivePaymentBooking(null); setView("bookings"); }} />}
        {view === "review" && <ReviewView onBack={() => setView("bookings")} onSubmit={() => { setHasReviewed(true); setView("bookings"); }} />}
        {view === "profile" && <ProfileView profile={customerProfile} onProfileChange={setCustomerProfile} onSave={saveCustomerProfile} onSignOut={onSignOut} onSupport={() => setView("support")} onInvoices={() => setView("invoices")} />}
      </ScrollView>
      {view !== "chat" && view !== "payment" && view !== "invoices" && <BottomNav active={activeTab} onPress={openTab} />}
    </View>
  );
}

function HomeView({ greeting, name, selectedService, setSelectedService, workers, customerLocation, onExplore, onWorker }: { greeting: string; name: string; selectedService: ServiceCategory; setSelectedService: (service: ServiceCategory) => void; workers: WorkerProfile[]; customerLocation: Coordinate; onExplore: () => void; onWorker: (worker: WorkerProfile) => void }) {
  return <>
    <View style={styles.greeting}><Text style={styles.overline}>{greeting.toUpperCase()}</Text><Text style={styles.title}>Hi, {name.split(" ")[0]}.</Text><Text style={styles.subtle}>What can the cooperative help with today?</Text></View>
    <Pressable onPress={onExplore} style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}><MaterialIcons name="search" size={22} color="#627D98" /><Text style={styles.searchPlaceholder}>Search a service or worker</Text><MaterialIcons name="tune" size={20} color="#0F766E" /></Pressable>
    <SectionHeader title="Services near you" action="See all" onPress={onExplore} />
    <View style={styles.serviceGrid}>{services.map((service) => <Pressable key={service.id} onPress={() => { setSelectedService(service); onExplore(); }} style={({ pressed }) => [styles.serviceCard, service.id === selectedService.id && styles.serviceCardActive, pressed && styles.pressed]}><View style={styles.serviceIcon}><MaterialIcons name={service.icon} size={25} color="#0F766E" /></View><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.serviceFrom}>From ₹{service.startingPrice}</Text></Pressable>)}</View>
    <SectionHeader title="Trusted nearby workers" action="View map" onPress={onExplore} />
    <View style={styles.workerStack}>{workers.slice(0, 2).map((worker) => <WorkerCard worker={worker} customerLocation={customerLocation} key={worker.id} onPress={() => onWorker(worker)} />)}</View>
    <SectionHeader title="Your next booking" />
    <View style={styles.nextBooking}><View style={styles.dateBox}><Text style={styles.dateDay}>18</Text><Text style={styles.dateMonth}>JUL</Text></View><View style={styles.flex}><Text style={styles.nextBookingTitle}>Plumbing visit with Rajesh</Text><Text style={styles.nextBookingInfo}>Today · 4:30 PM · Confirmed</Text></View><MaterialIcons name="chevron-right" size={24} color="#627D98" /></View>
  </>;
}

function ExploreView({ query, setQuery, selectedService, serviceFilter, setServiceFilter, activeFilter, setActiveFilter, workers, customerLocation, onWorker }: { query: string; setQuery: (value: string) => void; selectedService: ServiceCategory; serviceFilter: string | null; setServiceFilter: (value: string | null) => void; activeFilter: WorkerFilter; setActiveFilter: (filter: WorkerFilter) => void; workers: WorkerProfile[]; customerLocation: Coordinate; onWorker: (worker: WorkerProfile) => void }) {
  const filters: WorkerFilter[] = ["All", "Online now", "Verified", "Top rated", "Emergency ready"];
  return <><View style={styles.screenIntro}><Text style={styles.title}>Explore local help</Text><Text style={styles.subtle}>Verified cooperative workers in your area.</Text></View><View style={styles.inputSearch}><MaterialIcons name="search" size={21} color="#627D98" /><TextInput value={query} onChangeText={setQuery} placeholder="Plumber, electrician, cleaner…" placeholderTextColor="#829AB1" style={styles.searchInput} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Show all services" activeOpacity={0.72} onPress={() => setServiceFilter(null)} style={[styles.filterChip, !serviceFilter && styles.filterChipActive]}><Text style={[styles.filterText, !serviceFilter && styles.filterTextActive]}>All services</Text></TouchableOpacity>{services.map((service) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Show ${service.name} workers`} activeOpacity={0.72} key={service.id} onPress={() => setServiceFilter(service.name)} style={[styles.filterChip, serviceFilter === service.name && styles.filterChipActive]}><Text style={[styles.filterText, serviceFilter === service.name && styles.filterTextActive]}>{service.name}</Text></TouchableOpacity>)}</ScrollView><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((filter) => { const selected = activeFilter === filter; return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Filter workers by ${filter}`} activeOpacity={0.72} key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter}</Text></TouchableOpacity>; })}</ScrollView><Text style={styles.resultText}>{workers.length} {workers.length === 1 ? "worker" : "workers"} available nearby</Text>{workers.length === 0 ? <View style={styles.emptyWorkers}><MaterialIcons name="search-off" size={28} color="#0F766E" /><Text style={styles.emptyWorkersTitle}>No workers match these filters</Text><Text style={styles.emptyWorkersCopy}>Try another service, search phrase, or choose All workers.</Text></View> : <View style={styles.workerStack}>{workers.map((worker) => <WorkerCard worker={worker} customerLocation={customerLocation} key={worker.id} onPress={() => onWorker(worker)} />)}</View>}</>;
}

function WorkerView({ worker, onBack, onBook }: { worker: WorkerProfile; onBack: () => void; onBook: () => void }) {
  const contactAvailable = false;
  return <><BackLabel label="Worker profile" onPress={onBack} /><View style={styles.profileHero}><View style={styles.avatarLarge}><Text style={styles.avatarText}>{initials(worker.name)}</Text></View><View style={styles.flex}><View style={styles.nameLine}><Text style={styles.profileName}>{worker.name}</Text>{worker.isVerified && <MaterialIcons name="verified" size={19} color="#0F766E" />}</View><Text style={styles.profileRole}>{worker.services.join(" · ")}</Text><View style={styles.ratingLine}><MaterialIcons name="star" size={17} color="#D97706" /><Text style={styles.ratingText}>{worker.rating} · {worker.reviewCount} reviews</Text><View style={[styles.dot, { backgroundColor: worker.isOnline ? "#15803D" : "#94A3B8" }]} /><Text style={styles.onlineText}>{worker.isOnline ? "Online" : "Offline"}</Text></View></View></View><InfoRow icon="work-outline" label={`${worker.experienceYears} years of experience`} /><InfoRow icon="location-on" label={worker.serviceArea} /><InfoRow icon="schedule" label={worker.availability} /><View style={styles.divider} /><Text style={styles.sectionTitle}>About {worker.name.split(" ")[0]}</Text><Text style={styles.bodyText}>{worker.about}</Text><Text style={styles.sectionTitle}>Skills & services</Text><View style={styles.skillWrap}>{worker.skills.map((skill) => <View style={styles.skillChip} key={skill}><Text style={styles.skillText}>{skill}</Text></View>)}</View><View style={styles.priceBanner}><View><Text style={styles.priceCaption}>STARTING FROM</Text><Text style={styles.price}>₹{worker.startingPrice}</Text></View><Text style={styles.priceNote}>Final price depends on the job.</Text></View><View style={styles.actionStack}><PrimaryButton label="Book service" icon="calendar-month" onPress={onBook} /><View style={styles.dualAction}><DisabledAction label="Message" icon="chat-bubble-outline" disabled={!contactAvailable} /><DisabledAction label="Call" icon="call" disabled={!contactAvailable} /></View><Text style={styles.guardText}>Message and call unlock after the worker accepts a valid booking.</Text></View></>;
}

function BookingView({ worker, service, priority, setPriority, bookingDate, setBookingDate, bookingTime, setBookingTime, description, setDescription, serviceLocation, onUseCurrentLocation, bookingImageUri, onChooseImage, onBack, onConfirm, isSubmitting }: { worker: WorkerProfile; service: ServiceCategory; priority: BookingPriority; setPriority: (priority: BookingPriority) => void; bookingDate: string; setBookingDate: (date: string) => void; bookingTime: string; setBookingTime: (time: string) => void; description: string; setDescription: (value: string) => void; serviceLocation: { latitude: number; longitude: number; label: string }; onUseCurrentLocation: () => void; bookingImageUri: string | null; onChooseImage: () => void; onBack: () => void; onConfirm: () => void; isSubmitting: boolean }) {
  return <><BackLabel label="Book a service" onPress={onBack} /><View style={styles.bookingWorker}><View style={styles.avatarMedium}><Text style={styles.avatarText}>{initials(worker.name)}</Text></View><View><Text style={styles.bookingWorkerHeaderName}>{worker.name}</Text><Text style={styles.bookingWorkerInfo}>{service.name} · starts at ₹{service.startingPrice}</Text></View></View><Text style={styles.fieldHeading}>Your service details</Text><SelectRow icon="build" label="Service" value={service.name} /><SelectRow icon="calendar-today" label="Date" value={bookingDate} onPress={() => setBookingDate(bookingDate === "Tomorrow" ? "Saturday" : "Tomorrow")} /><SelectRow icon="schedule" label="Time" value={priority === "emergency" ? "As soon as possible" : bookingTime} onPress={() => setBookingTime(bookingTime === "11:00 AM" ? "3:30 PM" : "11:00 AM")} /><View style={styles.priorityCard}><Text style={styles.fieldLabel}>Booking type</Text><View style={styles.priorityRow}>{(["standard", "on_demand", "emergency"] as BookingPriority[]).map((option) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: priority === option }} accessibilityLabel={`Choose ${option.replace("_", " ")} booking`} activeOpacity={0.72} key={option} onPress={() => setPriority(option)} style={[styles.priorityOption, priority === option && styles.priorityOptionActive]}><MaterialIcons name={option === "emergency" ? "priority-high" : option === "on_demand" ? "bolt" : "event-available"} size={17} color={priority === option ? "#FFFFFF" : "#0F766E"} /><Text style={[styles.priorityOptionText, priority === option && styles.priorityOptionTextActive]}>{option === "on_demand" ? "On demand" : option === "emergency" ? "Emergency" : "Standard"}</Text></TouchableOpacity>)}</View><Text style={styles.priorityHint}>{priority === "emergency" ? "Urgent requests are routed to emergency-ready workers first." : priority === "on_demand" ? "Request the earliest available slot from the worker." : "Choose a planned service time with the worker."}</Text></View><SelectRow icon="location-on" label="Location" value={serviceLocation.label} onPress={onUseCurrentLocation} /><ServiceMap latitude={serviceLocation.latitude} longitude={serviceLocation.longitude} label={serviceLocation.label} /><View style={styles.descriptionCard}><Text style={styles.fieldLabel}>Describe the work</Text><TextInput multiline value={description} onChangeText={setDescription} placeholder="For example: kitchen sink leaking below the drain." placeholderTextColor="#829AB1" style={styles.descriptionInput} /><Pressable onPress={onChooseImage} style={({ pressed }) => [styles.photoRow, pressed && styles.pressed]}><MaterialIcons name="add-a-photo" size={18} color="#0F766E" /><Text style={styles.photoText}>{bookingImageUri ? "Photo selected · change photo" : "Add a photo (optional)"}</Text></Pressable>{bookingImageUri && <Image source={{ uri: bookingImageUri }} style={styles.bookingPhotoPreview} />}</View><View style={styles.estimateCard}><View><Text style={styles.estimateLabel}>ESTIMATED STARTING PRICE</Text><Text style={styles.estimatePrice}>₹{service.startingPrice}</Text></View><Text style={styles.estimateNote}>You will confirm the final price with the worker.</Text></View><PrimaryButton label={isSubmitting ? "Sending booking…" : "Confirm booking"} icon="check-circle-outline" onPress={onConfirm} disabled={isSubmitting} /></>;
}

function ConfirmationView({ booking, worker, service, onBookings }: { booking: { id: string; status: BookingStatus; date: string; time: string }; worker: WorkerProfile; service: ServiceCategory; onBookings: () => void }) {
  const contactAvailable = isBookingContactEligible(booking.status);
  return <View style={styles.confirmation}><View style={styles.successIcon}><MaterialIcons name="calendar-month" size={34} color="#15803D" /></View><Text style={styles.confirmTitle}>Booking requested</Text><Text style={styles.confirmCopy}>Your request has been sent to {worker.name.split(" ")[0]}. We will notify you as soon as they respond.</Text><View style={styles.confirmDetailCard}><DetailRow label="Booking ID" value={booking.id} /><DetailRow label="Service" value={service.name} /><DetailRow label="Worker" value={worker.name} /><DetailRow label="Schedule" value={`${booking.date} · ${booking.time}`} /><DetailRow label="Status" value={bookingStatusLabel(booking.status)} emphasis /></View><View style={styles.dualAction}><DisabledAction label="Message worker" icon="chat-bubble-outline" disabled={!contactAvailable} /><DisabledAction label="Call worker" icon="call" disabled={!contactAvailable} /></View><Text style={styles.guardText}>Contact options become available after this booking is accepted.</Text><PrimaryButton label="View my bookings" icon="event-note" onPress={onBookings} /></View>;
}

function BookingsView({ createdBooking, liveBookings, selectedWorker, selectedService, availableWorkers, onWorker, onMessage, onCall, onPay, hasReviewed, onReview }: { createdBooking: { id: string; status: BookingStatus; date: string; time: string } | null; liveBookings: Booking[] | null; selectedWorker: WorkerProfile; selectedService: ServiceCategory; availableWorkers: WorkerProfile[]; onWorker: (worker: WorkerProfile) => void; onMessage: (booking: Booking) => void; onCall: (booking: Booking) => void; onPay: (booking: Booking) => void; hasReviewed: boolean; onReview: () => void }) {
  type BookingTab = "Upcoming" | "Active" | "Completed" | "Cancelled";
  const [activeTab, setActiveTab] = useState<BookingTab>("Upcoming");
  const persistedBookings = liveBookings?.map((booking) => ({ id: booking.id, worker: booking.workerName || selectedWorker.name, service: booking.serviceName, date: `${booking.date} · ${booking.time}`, status: booking.status, price: booking.price, source: booking }));
  const bookings = persistedBookings ?? (createdBooking ? [{ id: createdBooking.id, worker: selectedWorker.name, service: selectedService.name, date: `${createdBooking.date} · ${createdBooking.time}`, status: createdBooking.status, price: selectedService.startingPrice, source: undefined }, ...seedBookings.map((booking) => ({ ...booking, source: undefined }))] : seedBookings.map((booking) => ({ ...booking, source: undefined })));
  const tabStatuses: Record<BookingTab, BookingStatus[]> = { Upcoming: ["pending", "confirmed"], Active: ["accepted", "in_progress"], Completed: ["completed"], Cancelled: ["cancelled", "rejected"] };
  const visibleBookings = bookings.filter((booking) => tabStatuses[activeTab].includes(booking.status));
  return <><View style={styles.screenIntro}><Text style={styles.title}>My bookings</Text><Text style={styles.subtle}>Follow each service from request to completion.</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{(["Upcoming", "Active", "Completed", "Cancelled"] as BookingTab[]).map((tab) => { const selected = activeTab === tab; return <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={`Show ${tab.toLowerCase()} bookings`} activeOpacity={0.72} key={tab} onPress={() => setActiveTab(tab)} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{tab}</Text></TouchableOpacity>; })}</ScrollView>{visibleBookings.length === 0 ? <View style={styles.emptyWorkers}><MaterialIcons name="event-busy" size={28} color="#0F766E" /><Text style={styles.emptyWorkersTitle}>No {activeTab.toLowerCase()} bookings</Text><Text style={styles.emptyWorkersCopy}>Bookings will appear here when their status changes.</Text></View> : <View style={styles.bookingList}>{visibleBookings.map((booking) => <View key={booking.id} style={styles.bookingListCard}><Pressable onPress={() => onWorker(availableWorkers.find((worker) => worker.name === booking.worker) ?? availableWorkers[0])} style={({ pressed }) => [styles.bookingCardPress, pressed && styles.pressed]}><View style={styles.bookingListTop}><Text style={styles.bookingService}>{booking.service}</Text><StatusPill status={booking.status} /></View><Text style={styles.bookingWorkerName}>{booking.worker}</Text><Text style={styles.bookingSchedule}>{booking.date}</Text><View style={styles.bookingListFoot}><Text style={styles.bookingId}>{booking.id}</Text><Text style={styles.bookingCost}>from ₹{booking.price}</Text></View>{booking.source && <Text style={styles.paymentStatusText}>{booking.source.paymentStatus === "paid" ? "Payment confirmed" : booking.source.paymentStatus === "pending" ? "Payment confirmation pending" : booking.source.paymentStatus === "refunded" ? "Payment refunded" : "Payment not started"}</Text>}</Pressable>{booking.source && (booking.source.paymentStatus === "unpaid" || !booking.source.paymentStatus) && ["accepted", "confirmed", "in_progress", "completed"].includes(booking.status) && <Pressable onPress={() => onPay(booking.source!)} style={({ pressed }) => [styles.payBookingButton, pressed && styles.pressed]}><MaterialIcons name="payments" size={18} color="#C2410C" /><Text style={styles.payBookingText}>Pay ₹{booking.price}</Text></Pressable>}{booking.source && isBookingContactEligible(booking.status) && <View style={styles.bookingContactRow}><Pressable onPress={() => onMessage(booking.source)} style={({ pressed }) => [styles.messageBookingButton, styles.bookingContactButton, pressed && styles.pressed]}><MaterialIcons name="chat-bubble-outline" size={18} color="#0F766E" /><Text style={styles.messageBookingText}>Message</Text></Pressable><Pressable onPress={() => onCall(booking.source)} style={({ pressed }) => [styles.callBookingButton, styles.bookingContactButton, pressed && styles.pressed]}><MaterialIcons name="call" size={18} color="#0F766E" /><Text style={styles.messageBookingText}>Call</Text></Pressable></View>}{canLeaveReview(booking.status, hasReviewed) && <Pressable onPress={onReview} style={({ pressed }) => [styles.rateButton, pressed && styles.pressed]}><MaterialIcons name="star-outline" size={18} color="#D97706" /><Text style={styles.rateButtonText}>Rate this service</Text></Pressable>}{booking.status === "completed" && hasReviewed && <Text style={styles.ratedText}>Your review has been submitted. Thank you.</Text>}</View>)}</View>}</>;
}

function PaymentView({ booking, isSubmitting, onSubmit, onBack }: { booking: Booking; isSubmitting: boolean; onSubmit: (gateway: "razorpay" | "upi") => void; onBack: () => void }) {
  const [gateway, setGateway] = useState<"razorpay" | "upi">("razorpay");
  const cooperativeFee = Math.round(booking.price * 0.1);
  return <><BackLabel label="Secure payment" onPress={onBack} /><View style={styles.paymentCard}><View style={styles.paymentHero}><View style={styles.paymentIcon}><MaterialIcons name="account-balance-wallet" size={28} color="#0F766E" /></View><Text style={styles.formTitle}>Pay for {booking.serviceName}</Text><Text style={styles.formCopy}>Your payment record is attached to booking {booking.id}.</Text></View><View style={styles.paymentBreakdown}><DetailRow label="Service amount" value={`₹${booking.price}`} /><DetailRow label="Cooperative welfare & platform fee" value={`₹${cooperativeFee}`} /><DetailRow label="Worker payout" value={`₹${booking.price - cooperativeFee}`} /><View style={styles.paymentTotal}><Text style={styles.paymentTotalLabel}>Customer total</Text><Text style={styles.paymentTotalValue}>₹{booking.price}</Text></View></View><Text style={styles.fieldLabel}>Choose payment method</Text><View style={styles.paymentOptions}><TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: gateway === "razorpay" }} onPress={() => setGateway("razorpay")} style={[styles.paymentOption, gateway === "razorpay" && styles.paymentOptionActive]}><MaterialIcons name="credit-card" size={19} color={gateway === "razorpay" ? "#FFFFFF" : "#0F766E"} /><Text style={[styles.paymentOptionText, gateway === "razorpay" && styles.paymentOptionTextActive]}>Razorpay</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: gateway === "upi" }} onPress={() => setGateway("upi")} style={[styles.paymentOption, gateway === "upi" && styles.paymentOptionActive]}><MaterialIcons name="qr-code-2" size={19} color={gateway === "upi" ? "#FFFFFF" : "#0F766E"} /><Text style={[styles.paymentOptionText, gateway === "upi" && styles.paymentOptionTextActive]}>UPI</Text></TouchableOpacity></View><Text style={styles.paymentNotice}>The cooperative confirms the gateway callback before marking this booking paid and issuing an invoice.</Text><PrimaryButton label={isSubmitting ? "Starting payment…" : "Create secure payment request"} icon="lock" onPress={() => onSubmit(gateway)} /></View></>;
}

function CustomerConversation({ booking, user, onBack }: { booking: Booking; user: AppUser; onBack: () => void }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  useEffect(() => {
    try {
      return subscribeToMessages(booking.id, setMessages);
    } catch (error) {
      Alert.alert("Chat unavailable", error instanceof Error ? error.message : "Please try again shortly.");
      return undefined;
    }
  }, [booking.id]);
  const send = async () => {
    const message = text.trim();
    if (!message || isSending) return;
    setIsSending(true);
    try {
      await sendBookingMessage({ chatId: booking.id, senderId: user.id, receiverId: booking.workerId, message, bookingStatus: booking.status });
      setText("");
    } catch (error) {
      Alert.alert("Message not sent", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSending(false);
    }
  };
  return <View style={styles.customerChatPage}><Pressable onPress={onBack} style={({ pressed }) => [styles.chatHeader, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color="#102A43" /><View style={styles.flex}><Text style={styles.chatName}>{booking.workerName || "Worker"}</Text><Text style={styles.chatStatus}>Booking {booking.id} · {bookingStatusLabel(booking.status)}</Text></View></Pressable><View style={styles.validChat}><MaterialIcons name="verified-user" size={17} color="#15803D" /><Text style={styles.validChatText}>Secure booking chat is active</Text></View><ScrollView contentContainerStyle={styles.customerMessageStack}>{messages.length === 0 ? <Text style={styles.chatEmpty}>Send a message to coordinate this service.</Text> : messages.map((message) => { const mine = message.senderId === user.id; return <View key={message.id} style={[styles.customerBubble, mine && styles.customerOwnBubble]}><Text style={[styles.customerMessageText, mine && styles.customerOwnMessageText]}>{message.message}</Text><Text style={[styles.customerMessageTime, mine && styles.customerOwnMessageTime]}>{message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Now"}</Text></View>; })}</ScrollView><View style={styles.customerComposer}><TextInput value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor="#829AB1" style={styles.customerComposerInput} returnKeyType="send" onSubmitEditing={() => { void send(); }} /><Pressable onPress={() => { void send(); }} style={({ pressed }) => [styles.customerSendButton, (pressed || isSending) && styles.pressed]}><MaterialIcons name="send" size={19} color="#FFFFFF" /></Pressable></View></View>;
}

function ReviewView({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  return <><BackLabel label="Rate your service" onPress={onBack} /><View style={styles.reviewHero}><View style={styles.reviewIcon}><MaterialIcons name="star" size={30} color="#D97706" /></View><Text style={styles.reviewTitle}>How was your service?</Text><Text style={styles.reviewCopy}>Your feedback helps cooperative workers build a trusted local reputation.</Text></View><View style={styles.reviewCard}><Text style={styles.fieldLabel}>Your rating</Text><View style={styles.starRow}>{[1, 2, 3, 4, 5].map((star) => <Pressable key={star} onPress={() => setRating(star)} style={({ pressed }) => [styles.starPress, pressed && styles.pressed]}><MaterialIcons name={star <= rating ? "star" : "star-outline"} size={34} color="#D97706" /></Pressable>)}</View><Text style={styles.fieldLabel}>Write a review <Text style={styles.optionalText}>(optional)</Text></Text><TextInput multiline value={comment} onChangeText={setComment} placeholder="Tell us about the service experience." placeholderTextColor="#829AB1" style={styles.reviewInput} /></View><PrimaryButton label="Submit review" icon="send" onPress={() => rating ? onSubmit() : Alert.alert("Choose a rating", "Select one to five stars before submitting your review.")} /></>;
}

function ProfileView({ profile, onProfileChange, onSave, onSignOut, onSupport, onInvoices }: { profile: CustomerProfileDraft; onProfileChange: (profile: CustomerProfileDraft) => void; onSave: () => Promise<void>; onSignOut: () => Promise<void>; onSupport: () => void; onInvoices: () => void }) {
  const [section, setSection] = useState<"menu" | "details" | "address" | "notifications">("menu");
  const update = (patch: Partial<CustomerProfileDraft>) => onProfileChange({ ...profile, ...patch });
  if (section !== "menu") {
    const title = section === "details" ? "Personal details" : section === "address" ? "Saved address" : "Notifications";
    return <><BackLabel label={title} onPress={() => setSection("menu")} /><View style={styles.profileForm}><Text style={styles.formTitle}>{title}</Text>{section === "details" && <><Text style={styles.fieldLabel}>Full name</Text><TextInput value={profile.name} onChangeText={(value) => update({ name: value })} placeholder="Your full name" placeholderTextColor="#829AB1" style={styles.profileInput} /><Text style={styles.fieldLabel}>Phone number</Text><TextInput value={profile.phone} onChangeText={(value) => update({ phone: value })} placeholder="10-digit mobile number" keyboardType="phone-pad" placeholderTextColor="#829AB1" style={styles.profileInput} /></>}{section === "address" && <><Text style={styles.fieldLabel}>Service address</Text><TextInput value={profile.address} onChangeText={(value) => update({ address: value })} placeholder="House / area / city" placeholderTextColor="#829AB1" multiline style={styles.profileMultilineInput} /></>}{section === "notifications" && <><Text style={styles.formCopy}>Choose whether to receive booking and service updates on this device.</Text><Pressable onPress={() => update({ notificationsEnabled: !profile.notificationsEnabled })} style={({ pressed }) => [styles.preferenceRow, pressed && styles.pressed]}><View style={styles.flex}><Text style={styles.preferenceTitle}>Booking updates</Text><Text style={styles.preferenceCopy}>Requests, acceptance, job status, and messages</Text></View><MaterialIcons name={profile.notificationsEnabled ? "toggle-on" : "toggle-off"} size={38} color={profile.notificationsEnabled ? "#0F766E" : "#94A3B8"} /></Pressable><Text style={styles.fieldLabel}>Language</Text><View style={styles.languageRow}>{LANGUAGE_OPTIONS.map((option) => <TouchableOpacity key={option.code} accessibilityRole="button" accessibilityState={{ selected: profile.language === option.code }} onPress={() => update({ language: option.code })} style={[styles.languageOption, profile.language === option.code && styles.languageOptionActive]}><Text style={[styles.languageOptionText, profile.language === option.code && styles.languageOptionTextActive]}>{option.nativeLabel}</Text></TouchableOpacity>)}</View></>}<PrimaryButton label="Save changes" icon="check" onPress={() => { onSave().then(() => { setSection("menu"); Alert.alert("Profile saved", "Your updates have been saved to your account."); }).catch((error) => Alert.alert("Profile not saved", error instanceof Error ? error.message : "Please try again.")); }} /></View></>;
  }
  return <><View style={styles.screenIntro}><Text style={styles.title}>Your profile</Text><Text style={styles.subtle}>Manage your preferences and account.</Text></View><View style={styles.customerProfile}><View style={styles.avatarLarge}><Text style={styles.avatarText}>{initials(profile.name)}</Text></View><Text style={styles.customerName}>{profile.name}</Text><Text style={styles.customerEmail}>Customer account</Text></View><Pressable onPress={() => setSection("details")} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}><MaterialIcons name="person-outline" size={21} color="#0F766E" /><Text style={styles.settingsText}>Personal details</Text><MaterialIcons name="chevron-right" size={22} color="#829AB1" /></Pressable><Pressable onPress={() => setSection("address")} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}><MaterialIcons name="location-on" size={21} color="#0F766E" /><View style={styles.flex}><Text style={styles.settingsText}>Saved address</Text><Text style={styles.settingsHint}>{profile.address || "Add an address"}</Text></View><MaterialIcons name="chevron-right" size={22} color="#829AB1" /></Pressable><Pressable onPress={() => setSection("notifications")} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}><MaterialIcons name="notifications-none" size={21} color="#0F766E" /><Text style={styles.settingsText}>Notifications</Text><Text style={styles.settingsValue}>{profile.notificationsEnabled ? "On" : "Off"}</Text><MaterialIcons name="chevron-right" size={22} color="#829AB1" /></Pressable><Pressable onPress={onInvoices} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}><MaterialIcons name="receipt-long" size={21} color="#0F766E" /><Text style={styles.settingsText}>Invoices</Text><MaterialIcons name="chevron-right" size={22} color="#829AB1" /></Pressable><Pressable onPress={onSupport} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}><MaterialIcons name="help-outline" size={21} color="#0F766E" /><Text style={styles.settingsText}>Help & support</Text><MaterialIcons name="chevron-right" size={22} color="#829AB1" /></Pressable><Pressable onPress={onSignOut} style={({ pressed }) => [styles.logOutRow, pressed && styles.pressed]}><MaterialIcons name="logout" size={21} color="#C2410C" /><Text style={styles.logOutText}>Sign out</Text></Pressable></>;
}

function InvoicesView({ invoices, onBack }: { invoices: Invoice[] | null; onBack: () => void }) {
  return <><BackLabel label="Invoices" onPress={onBack} /><View style={styles.screenIntro}><Text style={styles.title}>Payment history</Text><Text style={styles.subtle}>Invoices are issued by the cooperative after gateway confirmation.</Text></View>{invoices === null ? <View style={styles.emptyWorkers}><MaterialIcons name="sync" size={28} color="#0F766E" /><Text style={styles.emptyWorkersTitle}>Loading invoices</Text><Text style={styles.emptyWorkersCopy}>Your participant-restricted invoice records are loading.</Text></View> : invoices.length === 0 ? <View style={styles.emptyWorkers}><MaterialIcons name="receipt-long" size={28} color="#0F766E" /><Text style={styles.emptyWorkersTitle}>No invoices yet</Text><Text style={styles.emptyWorkersCopy}>Paid bookings will show their digital invoice here.</Text></View> : <View style={styles.invoiceList}>{invoices.map((invoice) => <View key={invoice.id} style={styles.invoiceCard}><View style={styles.invoiceHeader}><View><Text style={styles.invoiceTitle}>Cooperative service invoice</Text><Text style={styles.invoiceBooking}>Booking {invoice.bookingId}</Text></View><PaymentStatusPill status={invoice.status} /></View><View style={styles.invoiceRows}><DetailRow label="Service subtotal" value={`₹${invoice.subtotal}`} /><DetailRow label="Cooperative fee" value={`₹${invoice.cooperativeFee}`} /><DetailRow label="Total paid" value={`₹${invoice.total}`} /></View></View>)}</View>}</>;
}

function ComplaintView({ category, setCategory, description, setDescription, isSubmitting, onSubmit, onBack }: { category: "service_quality" | "safety" | "payment" | "other"; setCategory: (category: "service_quality" | "safety" | "payment" | "other") => void; description: string; setDescription: (value: string) => void; isSubmitting: boolean; onSubmit: () => void; onBack: () => void }) {
  const categories: { id: "service_quality" | "safety" | "payment" | "other"; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [{ id: "service_quality", label: "Service", icon: "handyman" }, { id: "safety", label: "Safety", icon: "health-and-safety" }, { id: "payment", label: "Payment", icon: "payments" }, { id: "other", label: "Other", icon: "more-horiz" }];
  return <><BackLabel label="Help & support" onPress={onBack} /><View style={styles.supportCard}><View style={styles.supportIcon}><MaterialIcons name="support-agent" size={28} color="#0F766E" /></View><Text style={styles.formTitle}>Report an issue</Text><Text style={styles.formCopy}>Tell the cooperative team what happened. Safety concerns are prioritised.</Text><Text style={styles.fieldLabel}>Issue category</Text><View style={styles.complaintCategoryRow}>{categories.map((item) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={[styles.complaintCategoryButton, category === item.id && styles.complaintCategoryButtonActive]}><MaterialIcons name={item.icon} size={17} color={category === item.id ? "#FFFFFF" : "#0F766E"} /><Text style={[styles.complaintCategoryText, category === item.id && styles.complaintCategoryTextActive]}>{item.label}</Text></TouchableOpacity>)}</View><Text style={styles.fieldLabel}>What should we know?</Text><TextInput value={description} onChangeText={setDescription} multiline placeholder="Describe the issue clearly and include the booking ID if relevant." placeholderTextColor="#829AB1" style={styles.complaintTextArea} /><PrimaryButton label={isSubmitting ? "Submitting…" : "Submit report"} icon="send" onPress={onSubmit} disabled={isSubmitting || !description.trim()} /></View></>;
}

function WorkerCard({ worker, customerLocation, onPress }: { worker: WorkerProfile; customerLocation?: Coordinate; onPress: () => void }) {
  const distance = worker.location && customerLocation ? distanceInKm(customerLocation, worker.location) : null;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.workerCard, pressed && styles.pressed]}><View style={styles.avatarMedium}><Text style={styles.avatarText}>{initials(worker.name)}</Text></View><View style={styles.flex}><View style={styles.workerNameLine}><Text style={styles.workerName}>{worker.name}</Text>{worker.isVerified && <MaterialIcons name="verified" size={17} color="#0F766E" />}</View><Text style={styles.workerService}>{worker.services[0]} · {worker.experienceYears} yrs experience</Text><View style={styles.workerMeta}><MaterialIcons name="star" size={15} color="#D97706" /><Text style={styles.metaText}>{worker.rating} ({worker.reviewCount})</Text><Text style={styles.metaDot}>•</Text><Text style={styles.metaText}>{distance === null ? "Distance unavailable" : `${distance.toFixed(1)} km away`}</Text></View><View style={[styles.onlineBadge, !worker.isOnline && styles.offlineBadge]}><View style={[styles.dot, { backgroundColor: worker.isOnline ? "#15803D" : "#94A3B8" }]} /><Text style={[styles.onlineBadgeText, !worker.isOnline && styles.offlineBadgeText]}>{worker.isOnline ? "Available now" : "Next available tomorrow"}</Text></View></View><View style={styles.workerPrice}><Text style={styles.workerPriceCaption}>FROM</Text><Text style={styles.workerPriceValue}>₹{worker.startingPrice}</Text><MaterialIcons name="chevron-right" size={22} color="#627D98" /></View></Pressable>;
}

function BottomNav({ active, onPress }: { active: string; onPress: (view: CustomerView) => void }) { const tabs: { label: string; view: CustomerView; icon: keyof typeof MaterialIcons.glyphMap }[] = [{ label: "Home", view: "home", icon: "home-filled" }, { label: "Explore", view: "explore", icon: "search" }, { label: "Bookings", view: "bookings", icon: "event-note" }, { label: "Profile", view: "profile", icon: "person" }]; return <View style={styles.bottomNav}>{tabs.map((tab) => { const isActive = active === tab.label; return <Pressable key={tab.label} onPress={() => onPress(tab.view)} style={({ pressed }) => [styles.navTab, pressed && styles.pressed]}><MaterialIcons name={tab.icon} size={22} color={isActive ? "#0F766E" : "#627D98"} /><Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text></Pressable>; })}</View>; }
function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}><Text style={styles.sectionActionText}>{action}</Text><MaterialIcons name="chevron-right" size={18} color="#0F766E" /></Pressable>}</View>; }
function BackLabel({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.backLabel, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#102A43" /><Text style={styles.backLabelText}>{label}</Text></Pressable>; }
function PrimaryButton({ label, icon, onPress, disabled }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && { opacity: 0.62 }, pressed && !disabled && styles.primaryPressed]}><Text style={styles.primaryText}>{label}</Text><MaterialIcons name={icon} size={20} color="#FFFFFF" /></Pressable>; }
function DisabledAction({ label, icon, disabled }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; disabled: boolean }) { return <Pressable disabled={disabled} onPress={() => Alert.alert(label, "A valid active booking is required before contact is available.")} style={styles.disabledAction}><MaterialIcons name={icon} size={20} color="#94A3B8" /><Text style={styles.disabledText}>{label}</Text></Pressable>; }
function SelectRow({ icon, label, value, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; onPress?: () => void }) { return <Pressable onPress={onPress ?? (() => Alert.alert(label, "Selection controls will be connected to live availability in the Firebase-enabled release."))} style={({ pressed }) => [styles.selectRow, pressed && styles.pressed]}><View style={styles.selectIcon}><MaterialIcons name={icon} size={20} color="#0F766E" /></View><View style={styles.flex}><Text style={styles.selectLabel}>{label}</Text><Text style={styles.selectValue}>{value}</Text></View><MaterialIcons name="chevron-right" size={22} color="#829AB1" /></Pressable>; }
function InfoRow({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) { return <View style={styles.infoRow}><MaterialIcons name={icon} size={20} color="#0F766E" /><Text style={styles.infoText}>{label}</Text></View>; }
function DetailRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) { return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, emphasis && styles.detailValueEmphasis]}>{value}</Text></View>; }
function StatusPill({ status }: { status: BookingStatus }) { const color = status === "completed" ? "#15803D" : status === "pending" ? "#D97706" : "#0F766E"; return <View style={[styles.statusPill, { backgroundColor: `${color}15` }]}><Text style={[styles.statusText, { color }]}>{bookingStatusLabel(status)}</Text></View>; }
function PaymentStatusPill({ status }: { status: PaymentStatus }) { const color = status === "paid" ? "#15803D" : status === "failed" ? "#C2410C" : status === "pending" ? "#D97706" : "#0F766E"; const label = status === "unpaid" ? "Not paid" : status.charAt(0).toUpperCase() + status.slice(1); return <View style={[styles.statusPill, { backgroundColor: `${color}15` }]}><Text style={[styles.statusText, { color }]}>{label}</Text></View>; }
function initials(value: string) { return value.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function distanceInKm(from: Coordinate, to: Coordinate) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitude = radians(from.latitude);
  const targetLatitude = radians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude) * Math.cos(targetLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function openBookingCall(phone?: string) {
  const dialablePhone = phone?.replace(/[^\d+]/g, "") ?? "";
  if (dialablePhone.replace(/\D/g, "").length < 10) {
    Alert.alert("Phone number unavailable", "This worker has not saved a valid contact number yet. Ask them to add it in their worker profile.");
    return;
  }
  try {
    const url = `tel:${dialablePhone}`;
    if (!(await Linking.canOpenURL(url))) throw new Error("No compatible dialer is available.");
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert("Calling unavailable", error instanceof Error ? error.message : "A compatible phone application is not available on this device.");
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F8F6" }, flex: { flex: 1 }, pressed: { opacity: 0.72 }, primaryPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  topbar: { alignItems: "center", backgroundColor: "#F7F8F6", flexDirection: "row", height: 64, justifyContent: "space-between", paddingHorizontal: 20 }, logoSmall: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 12, height: 36, justifyContent: "center", width: 36 }, location: { alignItems: "center", flexDirection: "row", gap: 2, marginLeft: "auto", marginRight: 12, maxWidth: 190, minHeight: 36 }, locationText: { color: "#102A43", flexShrink: 1, fontSize: 13, fontWeight: "800" }, circleButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 }, locationPicker: { backgroundColor: "#FFFFFF", borderBottomColor: "#D9E2EC", borderBottomWidth: 1, paddingHorizontal: 20, paddingBottom: 14, paddingTop: 4 }, locationPickerTitle: { color: "#102A43", fontSize: 13, fontWeight: "800", marginBottom: 10 }, locationCurrentRow: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 }, locationCurrentTitle: { color: "#0F766E", fontSize: 13, fontWeight: "800" }, locationCurrentCopy: { color: "#486581", fontSize: 11, lineHeight: 16, marginTop: 2 }, locationPickerHint: { color: "#627D98", fontSize: 11, fontWeight: "700", marginBottom: 8, marginTop: 12 }, locationOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, locationOption: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, locationOptionActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, locationOptionText: { color: "#486581", fontSize: 11, fontWeight: "800" }, locationOptionTextActive: { color: "#FFFFFF" },
  scroll: { padding: 20, paddingBottom: 108 }, greeting: { marginTop: 4 }, overline: { color: "#0F766E", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }, title: { color: "#102A43", fontSize: 29, fontWeight: "800", letterSpacing: -0.7, marginTop: 5 }, subtle: { color: "#627D98", fontSize: 14, lineHeight: 21, marginTop: 5 }, searchBar: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, height: 54, marginTop: 24, paddingHorizontal: 15 }, searchPlaceholder: { color: "#829AB1", flex: 1, fontSize: 14 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 28, marginBottom: 13 }, sectionTitle: { color: "#102A43", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }, sectionAction: { alignItems: "center", flexDirection: "row", minHeight: 28 }, sectionActionText: { color: "#0F766E", fontSize: 13, fontWeight: "800" }, serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, serviceCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, minHeight: 126, padding: 12, width: "47.8%" }, serviceCardActive: { borderColor: "#0F766E", borderWidth: 1.5 }, serviceIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 12, height: 43, justifyContent: "center", width: 43 }, serviceName: { color: "#102A43", fontSize: 14, fontWeight: "800", marginTop: 13 }, serviceFrom: { color: "#627D98", fontSize: 12, marginTop: 3 },
  workerStack: { gap: 12 }, workerCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 }, avatarMedium: { alignItems: "center", backgroundColor: "#CCE6E2", borderRadius: 16, height: 48, justifyContent: "center", width: 48 }, avatarLarge: { alignItems: "center", backgroundColor: "#CCE6E2", borderRadius: 26, height: 72, justifyContent: "center", width: 72 }, avatarText: { color: "#0F766E", fontSize: 17, fontWeight: "800" }, workerNameLine: { alignItems: "center", flexDirection: "row", gap: 5 }, workerName: { color: "#102A43", fontSize: 14, fontWeight: "800" }, workerService: { color: "#627D98", fontSize: 12, marginTop: 2 }, workerMeta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 7 }, metaText: { color: "#486581", fontSize: 11, fontWeight: "600" }, metaDot: { color: "#9FB3C8", fontSize: 11, marginHorizontal: 1 }, onlineBadge: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F0FDF4", borderRadius: 20, flexDirection: "row", gap: 5, marginTop: 8, paddingHorizontal: 8, paddingVertical: 4 }, offlineBadge: { backgroundColor: "#F1F5F9" }, dot: { borderRadius: 4, height: 7, width: 7 }, onlineBadgeText: { color: "#15803D", fontSize: 10, fontWeight: "800" }, offlineBadgeText: { color: "#64748B" }, workerPrice: { alignItems: "flex-end", marginLeft: "auto" }, workerPriceCaption: { color: "#829AB1", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }, workerPriceValue: { color: "#102A43", fontSize: 14, fontWeight: "800", marginTop: 2 },
  nextBooking: { alignItems: "center", backgroundColor: "#102A43", borderRadius: 18, flexDirection: "row", gap: 12, padding: 14 }, dateBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, height: 50, justifyContent: "center", width: 50 }, dateDay: { color: "#102A43", fontSize: 17, fontWeight: "800", lineHeight: 19 }, dateMonth: { color: "#0F766E", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, nextBookingTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, nextBookingInfo: { color: "#BCCCDC", fontSize: 12, marginTop: 4 },
  screenIntro: { marginTop: 4 }, inputSearch: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 9, height: 52, marginTop: 22, paddingHorizontal: 14 }, searchInput: { color: "#102A43", flex: 1, fontSize: 14, height: "100%" }, filters: { gap: 8, marginTop: 16, paddingRight: 16 }, filterChip: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 }, filterChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, filterText: { color: "#486581", fontSize: 12, fontWeight: "700" }, filterTextActive: { color: "#FFFFFF" }, resultText: { color: "#627D98", fontSize: 12, fontWeight: "700", marginVertical: 16 },
  backLabel: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, minHeight: 42, marginBottom: 15 }, backLabelText: { color: "#102A43", fontSize: 14, fontWeight: "800" }, profileHero: { alignItems: "center", flexDirection: "row", gap: 15, marginBottom: 22 }, nameLine: { alignItems: "center", flexDirection: "row", gap: 5 }, profileName: { color: "#102A43", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }, profileRole: { color: "#627D98", fontSize: 13, marginTop: 4 }, ratingLine: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 8 }, ratingText: { color: "#486581", fontSize: 12, fontWeight: "700" }, onlineText: { color: "#627D98", fontSize: 11, fontWeight: "700" }, infoRow: { alignItems: "center", flexDirection: "row", gap: 11, marginBottom: 14 }, infoText: { color: "#334E68", flex: 1, fontSize: 13, lineHeight: 19 }, divider: { backgroundColor: "#D9E2EC", height: 1, marginVertical: 11 }, bodyText: { color: "#486581", fontSize: 14, lineHeight: 21, marginTop: 9 }, skillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, skillChip: { backgroundColor: "#E6FFFA", borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7 }, skillText: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, priceBanner: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 28, padding: 15 }, priceCaption: { color: "#0F766E", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, price: { color: "#102A43", fontSize: 24, fontWeight: "800", marginTop: 1 }, priceNote: { color: "#486581", fontSize: 11, lineHeight: 16, maxWidth: 130, textAlign: "right" }, actionStack: { gap: 10, marginTop: 17 }, primaryButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 15, flexDirection: "row", gap: 9, height: 54, justifyContent: "center" }, primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, dualAction: { flexDirection: "row", gap: 10 }, disabledAction: { alignItems: "center", backgroundColor: "#F1F5F9", borderColor: "#E2E8F0", borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, height: 48, justifyContent: "center" }, disabledText: { color: "#94A3B8", fontSize: 13, fontWeight: "800" }, guardText: { color: "#829AB1", fontSize: 11, lineHeight: 16, textAlign: "center" },
  bookingWorker: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, marginBottom: 25, padding: 13 }, priorityCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, marginBottom: 10, padding: 14 }, priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }, priorityOption: { alignItems: "center", borderColor: "#99F6E4", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 9 }, priorityOptionActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, priorityOptionText: { color: "#0F766E", fontSize: 11, fontWeight: "800" }, priorityOptionTextActive: { color: "#FFFFFF" }, priorityHint: { color: "#627D98", fontSize: 11, lineHeight: 16, marginTop: 9 }, bookingWorkerHeaderName: { color: "#102A43", fontSize: 15, fontWeight: "800" }, bookingWorkerInfo: { color: "#627D98", fontSize: 12, marginTop: 4 }, fieldHeading: { color: "#102A43", fontSize: 18, fontWeight: "800", marginBottom: 12 }, selectRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, marginBottom: 10, minHeight: 64, padding: 12 }, selectIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 10, height: 36, justifyContent: "center", width: 36 }, selectLabel: { color: "#627D98", fontSize: 11, fontWeight: "700" }, selectValue: { color: "#102A43", fontSize: 13, fontWeight: "800", marginTop: 3 }, descriptionCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, marginTop: 3, padding: 14 }, fieldLabel: { color: "#334E68", fontSize: 13, fontWeight: "800" }, descriptionInput: { color: "#102A43", fontSize: 13, lineHeight: 19, minHeight: 80, paddingTop: 10, textAlignVertical: "top" }, photoRow: { alignItems: "center", borderTopColor: "#EAF0F5", borderTopWidth: 1, flexDirection: "row", gap: 8, paddingTop: 11 }, photoText: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, bookingPhotoPreview: { borderRadius: 10, height: 140, marginTop: 12, width: "100%" }, estimateCard: { alignItems: "center", backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginVertical: 16, padding: 14 }, estimateLabel: { color: "#C2410C", fontSize: 9, fontWeight: "800", letterSpacing: 0.65 }, estimatePrice: { color: "#9A3412", fontSize: 22, fontWeight: "800", marginTop: 2 }, estimateNote: { color: "#9A3412", fontSize: 11, lineHeight: 16, maxWidth: 145, textAlign: "right" },
  confirmation: { alignItems: "center", paddingTop: 25 }, successIcon: { alignItems: "center", backgroundColor: "#DCFCE7", borderRadius: 28, height: 64, justifyContent: "center", width: 64 }, confirmTitle: { color: "#102A43", fontSize: 25, fontWeight: "800", letterSpacing: -0.5, marginTop: 17 }, confirmCopy: { color: "#627D98", fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "center" }, confirmDetailCard: { alignSelf: "stretch", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, marginTop: 23, padding: 16 }, detailRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }, detailLabel: { color: "#627D98", fontSize: 12 }, detailValue: { color: "#102A43", fontSize: 12, fontWeight: "800", maxWidth: "62%", textAlign: "right" }, detailValueEmphasis: { color: "#D97706" },
  bookingList: { gap: 12, marginTop: 4 }, bookingListCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, overflow: "hidden" }, bookingCardPress: { padding: 15 }, bookingListTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, bookingService: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, statusPill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { fontSize: 10, fontWeight: "800" }, bookingWorkerName: { color: "#102A43", fontSize: 16, fontWeight: "800", marginTop: 10 }, bookingSchedule: { color: "#627D98", fontSize: 12, marginTop: 4 }, bookingListFoot: { borderTopColor: "#EAF0F5", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 13, paddingTop: 11 }, bookingId: { color: "#829AB1", fontSize: 11, fontWeight: "700" }, bookingCost: { color: "#102A43", fontSize: 12, fontWeight: "800" }, paymentStatusText: { color: "#627D98", fontSize: 10, fontWeight: "700", marginTop: 9 }, payBookingButton: { alignItems: "center", backgroundColor: "#FFF7ED", borderTopColor: "#FED7AA", borderTopWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 45 }, payBookingText: { color: "#C2410C", fontSize: 12, fontWeight: "800" }, bookingContactRow: { flexDirection: "row", gap: 1 }, bookingContactButton: { flex: 1 }, messageBookingButton: { alignItems: "center", backgroundColor: "#F0FDFA", borderTopColor: "#99F6E4", borderTopWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46 }, callBookingButton: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderLeftWidth: 1, borderTopWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46 }, messageBookingText: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, rateButton: { alignItems: "center", backgroundColor: "#FFF7ED", borderTopColor: "#FED7AA", borderTopWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 44 }, rateButtonText: { color: "#C2410C", fontSize: 12, fontWeight: "800" }, ratedText: { color: "#15803D", fontSize: 11, fontWeight: "800", paddingHorizontal: 15, paddingVertical: 12, textAlign: "center" }, customerChatPage: { flex: 1, paddingTop: 8 }, paymentCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, gap: 12, marginTop: 10, padding: 16 }, paymentHero: { alignItems: "center", paddingBottom: 6 }, paymentIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 22, height: 58, justifyContent: "center", marginBottom: 4, width: 58 }, paymentBreakdown: { backgroundColor: "#F7F8F6", borderRadius: 14, padding: 8 }, paymentTotal: { borderTopColor: "#D9E2EC", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 8, paddingTop: 11 }, paymentTotalLabel: { color: "#102A43", fontSize: 13, fontWeight: "800" }, paymentTotalValue: { color: "#0F766E", fontSize: 16, fontWeight: "800" }, paymentOptions: { flexDirection: "row", gap: 8 }, paymentOption: { alignItems: "center", backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46 }, paymentOptionActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, paymentOptionText: { color: "#486581", fontSize: 13, fontWeight: "800" }, paymentOptionTextActive: { color: "#FFFFFF" }, paymentNotice: { color: "#627D98", fontSize: 11, lineHeight: 16 }, chatHeader: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 52, paddingHorizontal: 4 }, chatName: { color: "#102A43", fontSize: 18, fontWeight: "800" }, chatStatus: { color: "#829AB1", fontSize: 11, marginTop: 2 }, validChat: { alignItems: "center", alignSelf: "center", backgroundColor: "#F0FDF4", borderRadius: 14, flexDirection: "row", gap: 7, marginTop: 14, paddingHorizontal: 12, paddingVertical: 8 }, validChatText: { color: "#15803D", fontSize: 12, fontWeight: "800" }, customerMessageStack: { gap: 10, paddingBottom: 20, paddingHorizontal: 4, paddingTop: 24 }, customerBubble: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, maxWidth: "82%", padding: 12 }, customerOwnBubble: { alignSelf: "flex-end", backgroundColor: "#0F766E", borderColor: "#0F766E" }, customerMessageText: { color: "#334E68", fontSize: 14, lineHeight: 20 }, customerOwnMessageText: { color: "#FFFFFF" }, customerMessageTime: { color: "#829AB1", fontSize: 10, marginTop: 6 }, customerOwnMessageTime: { color: "#CCFBF1" }, chatEmpty: { color: "#627D98", fontSize: 13, marginTop: 12, textAlign: "center" }, customerComposer: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, marginHorizontal: 4, padding: 8 }, customerComposerInput: { color: "#102A43", flex: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 8 }, customerSendButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 14, height: 42, justifyContent: "center", width: 46 }, reviewHero: { alignItems: "center", marginTop: 8 }, reviewIcon: { alignItems: "center", backgroundColor: "#FFF7ED", borderRadius: 27, height: 58, justifyContent: "center", width: 58 }, reviewTitle: { color: "#102A43", fontSize: 23, fontWeight: "800", marginTop: 13 }, reviewCopy: { color: "#627D98", fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: "center" }, invoiceList: { gap: 12, marginTop: 12 }, invoiceCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, padding: 15 }, invoiceHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, invoiceTitle: { color: "#102A43", fontSize: 14, fontWeight: "800" }, invoiceBooking: { color: "#627D98", fontSize: 11, marginTop: 4 }, invoiceRows: { backgroundColor: "#F7F8F6", borderRadius: 12, marginTop: 13, paddingHorizontal: 8 }, reviewCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, marginVertical: 22, padding: 16 }, starRow: { flexDirection: "row", gap: 6, marginBottom: 21, marginTop: 10 }, starPress: { minHeight: 42, minWidth: 38 }, optionalText: { color: "#829AB1", fontWeight: "500" }, reviewInput: { color: "#102A43", fontSize: 13, lineHeight: 19, minHeight: 88, paddingTop: 10, textAlignVertical: "top" },
  customerProfile: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, marginTop: 23, padding: 21 }, supportCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, gap: 10, padding: 16 }, supportIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 20, height: 58, justifyContent: "center", marginBottom: 4, width: 58 }, complaintCategoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 5 }, complaintCategoryButton: { alignItems: "center", backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 42, paddingHorizontal: 10 }, complaintCategoryButtonActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, complaintCategoryText: { color: "#486581", fontSize: 11, fontWeight: "800" }, complaintCategoryTextActive: { color: "#FFFFFF" }, complaintTextArea: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, color: "#102A43", fontSize: 13, lineHeight: 19, minHeight: 120, padding: 13, textAlignVertical: "top" }, customerName: { color: "#102A43", fontSize: 19, fontWeight: "800", marginTop: 11 }, customerEmail: { color: "#627D98", fontSize: 13, marginTop: 4 }, settingsRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 10, minHeight: 55, paddingHorizontal: 14 }, settingsText: { color: "#334E68", flex: 1, fontSize: 14, fontWeight: "700" }, logOutRow: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 48, marginTop: 16, paddingHorizontal: 14 }, logOutText: { color: "#C2410C", fontSize: 14, fontWeight: "800" },
  bottomNav: { backgroundColor: "#FFFFFF", borderTopColor: "#D9E2EC", borderTopWidth: 1, bottom: 0, flexDirection: "row", height: 68, left: 0, paddingTop: 8, position: "absolute", right: 0 }, navTab: { alignItems: "center", flex: 1, gap: 3 }, navLabel: { color: "#627D98", fontSize: 10, fontWeight: "700" }, navLabelActive: { color: "#0F766E" }, emptyWorkers: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, padding: 28 }, emptyWorkersTitle: { color: "#102A43", fontSize: 15, fontWeight: "800", marginTop: 10 }, emptyWorkersCopy: { color: "#627D98", fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "center" }, profileForm: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, gap: 10, padding: 16 }, formTitle: { color: "#102A43", fontSize: 19, fontWeight: "800", marginBottom: 6 }, formCopy: { color: "#627D98", fontSize: 13, lineHeight: 19, marginBottom: 4 }, profileInput: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, color: "#102A43", fontSize: 14, height: 48, marginBottom: 6, paddingHorizontal: 13 }, profileMultilineInput: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, color: "#102A43", fontSize: 14, lineHeight: 20, minHeight: 92, padding: 13, textAlignVertical: "top" }, preferenceRow: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 }, preferenceTitle: { color: "#102A43", fontSize: 13, fontWeight: "800" }, preferenceCopy: { color: "#486581", fontSize: 11, lineHeight: 16, marginTop: 3 }, settingsHint: { color: "#829AB1", fontSize: 10, marginTop: 2 }, settingsValue: { color: "#0F766E", fontSize: 11, fontWeight: "800" }, languageRow: { flexDirection: "row", gap: 8, marginBottom: 8 }, languageOption: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, languageOptionActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, languageOptionText: { color: "#486581", fontSize: 13, fontWeight: "700" }, languageOptionTextActive: { color: "#FFFFFF" },
});

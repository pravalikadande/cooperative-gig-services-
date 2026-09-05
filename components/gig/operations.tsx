import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Switch, View, Platform } from "react-native";

import { bookingStatusLabel, canLeaveReview, canTransitionBooking, isBookingContactEligible } from "@/lib/gig/booking-lifecycle";
import { reviewWorkerKyc, saveWorkerKyc, sendBookingMessage, subscribeToAdminData, subscribeToAllWorkerKyc, subscribeToBookings, subscribeToMessages, subscribeToWorkerKyc, updateBookingStatus, uploadKycDocument, type AdminData } from "@/lib/gig/firebase-repository";
import { requestCurrentServiceLocation } from "@/lib/gig/location";
import { AppearanceSetting } from "@/components/gig/appearance-setting";
import { useColors } from "@/hooks/use-colors";
import type { AppUser, Booking, BookingStatus, ChatMessage } from "@/lib/gig/models";
import { GlobalLanguagePicker, LocalizedText, LocalizedTextInput, ProfileLanguagePicker, localizedAlert, useI18n } from "@/lib/i18n";

const Text = LocalizedText;
const TextInput = LocalizedTextInput;

type WorkerView = "dashboard" | "requests" | "jobs" | "earnings" | "profile" | "chat";
type AdminView = "overview" | "workers" | "kyc" | "users" | "bookings" | "financials" | "locations" | "reports" | "settings";

type Job = { id: string; customer: string; customerId?: string; customerPhone?: string; service: string; schedule: string; address: string; amount: number; status: BookingStatus; note: string };
type WorkerProfileDraft = { name: string; phone: string; services: string; serviceArea: string; availability: string; about: string };

const initialRequests: Job[] = [
  { id: "CGS-24128", customer: "Meera Shah", service: "Pipe repair", schedule: "Tomorrow · 11:00 AM", address: "Madhapur, Hyderabad", amount: 299, status: "pending", note: "Kitchen sink leaks below the drain. Please bring replacement washer if needed." },
  { id: "CGS-24131", customer: "Kiran Rao", service: "Bathroom fitting", schedule: "Friday · 3:30 PM", address: "Kondapur, Hyderabad", amount: 449, status: "pending", note: "Need an inspection before installing a new shower fitting." },
];

const initialJobs: Job[] = [
  { id: "CGS-24058", customer: "Asha Verma", service: "Plumbing visit", schedule: "Today · 4:30 PM", address: "Road No. 12, Banjara Hills", amount: 299, status: "confirmed", note: "A slow kitchen tap leak. Customer has requested an arrival message." },
];

export function WorkerOperations({ user, name: legacyName, onSaveProfile, onSignOut }: { user?: AppUser; name?: string; onSaveProfile: (input: { name?: string; phone?: string; address?: string; workerProfile?: Record<string, unknown> }) => Promise<void>; onSignOut: () => Promise<void> }) {
  const name = user?.name ?? legacyName ?? "Worker";
  const colors = useColors();
  const [view, setView] = useState<WorkerView>("dashboard");
  const [isOnline, setIsOnline] = useState(true);
  const [liveBookings, setLiveBookings] = useState<Booking[] | null>(null);

  const [activeChat, setActiveChat] = useState<Job | null>(null);
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeChat) { setActiveChat(null); setView("jobs"); return true; }
      if (view !== "dashboard") { setView("dashboard"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [activeChat, view]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfileDraft>({ name, phone: user?.phone ?? "", services: "Plumber, Handyman", serviceArea: "Banjara Hills & nearby", availability: "Available today, 10:00 AM – 7:00 PM", about: "Experienced cooperative worker focused on transparent, dependable service." });
  const saveWorkerProfile = async () => {
    await onSaveProfile({
      name: workerProfile.name,
      phone: workerProfile.phone,
      workerProfile: {
        services: workerProfile.services,
        serviceArea: workerProfile.serviceArea,
        availability: workerProfile.availability,
        about: workerProfile.about,
        isOnline,
      },
    });
  };
  const updateOnlineAvailability = (value: boolean) => {
    setIsOnline(value);
    onSaveProfile({ workerProfile: { isOnline: value } }).catch(() => {
      setIsOnline(!value);
      localizedAlert("Availability not updated", "We could not update your public worker availability. Please try again.");
    });
  };
  const useCurrentServiceArea = async () => {
    const result = await requestCurrentServiceLocation();
    if (!result.ok) {
      localizedAlert("Area not updated", result.message);
      return;
    }
    setWorkerProfile((profile) => ({ ...profile, serviceArea: result.label }));
    try {
      await onSaveProfile({ workerProfile: { serviceArea: result.label, location: { latitude: result.latitude, longitude: result.longitude } } });
      localizedAlert("Service area updated", `${result.label} is now shown on your public worker profile.`);
    } catch (error) {
      localizedAlert("Area not saved", error instanceof Error ? error.message : "Please try again.");
    }
  };
  useEffect(() => {
    if (!user?.id) return undefined;
    try {
      return subscribeToBookings(user.id, "worker", setLiveBookings);
    } catch {
      return undefined;
    }
  }, [user?.id]);
  const liveJobs = liveBookings?.map(bookingToJob) ?? [];
  const requests = liveJobs;
  const jobs = liveJobs;
  const earnings = useMemo(() => (liveBookings ?? []).filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + (Number.isFinite(booking.price) ? booking.price : 0), 0), [liveBookings]);
  const pending = requests.filter((job) => job.status === "pending");
  const activeJobs = jobs.filter((job) => ["accepted", "confirmed", "in_progress"].includes(job.status));

  const accept = async (request: Job) => {
    if (!canTransitionBooking(request.status, "accepted")) return;
    try {
      await updateBookingStatus(request.id, "accepted");
      localizedAlert("Request accepted", `${request.customer} has been notified. Confirm the schedule before starting the job.`);
    } catch (error) {
      localizedAlert("Request not updated", error instanceof Error ? error.message : "Please try again.");
    }
  };
  const reject = async (request: Job) => {
    try { await updateBookingStatus(request.id, "rejected"); localizedAlert("Request declined", "The customer will receive a respectful update."); } catch (error) { localizedAlert("Request not updated", error instanceof Error ? error.message : "Please try again."); }
  };
  const updateJob = async (job: Job, next: BookingStatus) => {
    if (!canTransitionBooking(job.status, next)) return;
    try { await updateBookingStatus(job.id, next); } catch (error) { localizedAlert("Job not updated", error instanceof Error ? error.message : "Please try again."); return; }

  };
  const selectedView = view === "chat" ? "jobs" : view;

  return <View style={[styles.page, { backgroundColor: colors.background }]}>
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} ><View><Text style={styles.headerOverline}>WORKER DASHBOARD</Text><Text style={styles.headerTitle}>Hello, {workerProfile.name.split(" ")[0]}.</Text></View><View style={styles.onlineWrap}><View style={[styles.onlineDot, { backgroundColor: isOnline ? "#15803D" : "#94A3B8" }]} /><Text style={styles.onlineLabel}>{isOnline ? "Online" : "Offline"}</Text><Switch value={isOnline} onValueChange={updateOnlineAvailability} trackColor={{ false: "#CBD5E1", true: "#99F6E4" }} thumbColor={isOnline ? "#0F766E" : "#FFFFFF"} /></View></View>
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {view === "dashboard" && <WorkerDashboard isOnline={isOnline} pending={pending.length} active={activeJobs.length} earnings={earnings} onRequests={() => setView("requests")} onJobs={() => setView("jobs")} onEarnings={() => setView("earnings")} />}
      {view === "requests" && <JobRequests items={pending} onAccept={accept} onReject={reject} />}
      {view === "jobs" && <ActiveJobs items={activeJobs} onChat={(job) => { setActiveChat(job); setView("chat"); }} onConfirm={(job) => { void updateJob(job, "confirmed"); }} onStart={(job) => { void updateJob(job, "in_progress"); }} onComplete={(job) => { void updateJob(job, "completed"); }} />}
      {view === "earnings" && <Earnings today={earnings} jobs={jobs} />}
      {view === "profile" && <WorkerProfile workerId={user?.id} profile={workerProfile} jobs={jobs} earnings={earnings} onProfileChange={setWorkerProfile} onSave={saveWorkerProfile} onUseCurrentArea={useCurrentServiceArea} onSignOut={onSignOut} />}
      {view === "chat" && activeChat && <Conversation job={activeChat} user={user} onBack={() => setView("jobs")} />}
    </ScrollView>
    {view !== "chat" && <WorkerBottomNav active={selectedView} onPress={setView} />}
  </View>;
}

function WorkerDashboard({ isOnline, pending, active, earnings, onRequests, onJobs, onEarnings }: { isOnline: boolean; pending: number; active: number; earnings: number; onRequests: () => void; onJobs: () => void; onEarnings: () => void }) {
  return <><View style={[styles.availabilityCard, !isOnline && styles.availabilityCardOffline]}><View style={styles.availabilityIcon}><MaterialIcons name={isOnline ? "bolt" : "pause-circle-outline"} size={22} color={isOnline ? "#0F766E" : "#64748B"} /></View><View style={styles.flex}><Text style={styles.availabilityTitle}>{isOnline ? "You’re visible to nearby customers" : "You’re offline"}</Text><Text style={styles.availabilityCopy}>{isOnline ? "New service requests can reach you now." : "Turn on availability when you are ready for work."}</Text></View></View><View style={styles.metricGrid}><Metric icon="inbox" label="Pending" value={String(pending)} accent="#D97706" onPress={onRequests} /><Metric icon="engineering" label="Active jobs" value={String(active)} accent="#0F766E" onPress={onJobs} /><Metric icon="account-balance-wallet" label="Today" value={`₹${earnings.toLocaleString("en-IN")}`} accent="#15803D" onPress={onEarnings} /></View><Section title="Today’s next job" action="Open job" onPress={onJobs} /><View style={styles.nextJob}><View style={styles.timeSquare}><Text style={styles.timeTop}>4:30</Text><Text style={styles.timeBottom}>PM</Text></View><View style={styles.flex}><Text style={styles.nextJobTitle}>Plumbing visit · Asha Verma</Text><Text style={styles.nextJobCopy}>Banjara Hills · Confirmed</Text></View><MaterialIcons name="chevron-right" size={24} color="#627D98" /></View><Section title="Quick actions" /><View style={styles.quickGrid}><QuickAction icon="inbox" label="Requests" badge={pending} onPress={onRequests} /><QuickAction icon="work-outline" label="Active jobs" onPress={onJobs} /><QuickAction icon="account-balance-wallet" label="Earnings" onPress={onEarnings} /><QuickAction icon="star-outline" label="Ratings" onPress={() => localizedAlert("Ratings", "Your cooperative rating is 4.9 from 128 reviews.")} /></View></>;
}

function JobRequests({ items, onAccept, onReject }: { items: Job[]; onAccept: (job: Job) => void; onReject: (job: Job) => void }) {
  return <><Intro title="Job requests" copy="Respond quickly to keep the customer updated." /><View style={styles.stack}>{items.length === 0 ? <EmptyState icon="inbox" title="You’re all caught up" copy="New requests will appear here while you are online." /> : items.map((job) => <View key={job.id} style={styles.jobCard}><JobHeader job={job} /><Text style={styles.jobNote}>{job.note}</Text><View style={styles.jobActions}><SecondaryButton label="Decline" icon="close" onPress={() => onReject(job)} danger /><PrimaryButton label="Accept" icon="check" onPress={() => onAccept(job)} /></View></View>)}</View></>;
}

function ActiveJobs({ items, onChat, onConfirm, onStart, onComplete }: { items: Job[]; onChat: (job: Job) => void; onConfirm: (job: Job) => void; onStart: (job: Job) => void; onComplete: (job: Job) => void }) {
  return <><Intro title="Active jobs" copy="Keep the status current so every customer knows what to expect." /><View style={styles.stack}>{items.length === 0 ? <EmptyState icon="work-outline" title="No active jobs" copy="Accepted bookings will appear here." /> : items.map((job) => <View key={job.id} style={styles.jobCard}><JobHeader job={job} /><Text style={styles.jobNote}>{job.note}</Text><View style={styles.contactRow}><SecondaryButton label="Message" icon="chat-bubble-outline" onPress={() => onChat(job)} /><SecondaryButton label="Call" icon="call" onPress={() => { void openPrivateCall(job.customerPhone); }} /></View>{job.status === "accepted" && <PrimaryButton label="Confirm booking" icon="event-available" onPress={() => onConfirm(job)} />}{job.status === "confirmed" && <PrimaryButton label="Start job" icon="play-arrow" onPress={() => onStart(job)} />}{job.status === "in_progress" && <PrimaryButton label="Mark completed" icon="task-alt" onPress={() => onComplete(job)} />}</View>)}</View></>;
}

function Earnings({ today, jobs }: { today: number; jobs: Job[] }) { const completed = jobs.filter((job) => job.status === "completed"); const total = completed.reduce((sum, job) => sum + job.amount, 0); return <><Intro title="Earnings" copy="A clear record of the work completed through the cooperative." /><View style={styles.earningsHero}><Text style={styles.earningsLabel}>RECORDED EARNINGS</Text><Text style={styles.earningsValue}>₹{today.toLocaleString("en-IN")}</Text><Text style={styles.earningsCopy}>{completed.length} completed jobs recorded</Text></View><View style={styles.metricGrid}><Metric icon="calendar-view-week" label="Completed value" value={`₹${total.toLocaleString("en-IN")}`} accent="#0F766E" /><Metric icon="task-alt" label="Completed" value={String(completed.length)} accent="#D97706" /></View>{completed.length === 0 ? <EmptyState icon="account-balance-wallet" title="No earnings recorded" copy="Completed bookings will appear here when live data is available." /> : <><Section title="Completed work" /><View style={styles.stack}>{completed.map((job) => <View style={styles.earningRow} key={job.id}><View style={styles.earningIcon}><MaterialIcons name="build" size={19} color="#0F766E" /></View><View style={styles.flex}><Text style={styles.earningTitle}>{job.service}</Text><Text style={styles.earningCopy}>{job.customer} · {job.schedule}</Text></View><Text style={styles.earningAmount}>₹{job.amount.toLocaleString("en-IN")}</Text></View>)}</View></>}</>; }

function WorkerProfile({ workerId, profile, jobs, earnings, onProfileChange, onSave, onUseCurrentArea, onSignOut, restricted = false }: { workerId?: string; profile: WorkerProfileDraft; jobs: Job[]; earnings: number; onProfileChange: (profile: WorkerProfileDraft) => void; onSave: () => Promise<void>; onUseCurrentArea: () => Promise<void>; onSignOut: () => Promise<void>; restricted?: boolean }) {
  const [section, setSection] = useState<"menu" | "details" | "services" | "area" | "availability" | "preview" | "kyc">("menu");
  const update = (patch: Partial<WorkerProfileDraft>) => onProfileChange({ ...profile, ...patch });
  const { t } = useI18n();
  useEffect(() => {
    if (profile.phone.trim().replace(/\D/g, "").length >= 10) return;
    localizedAlert(
      t("Add phone number", "Add phone number"),
      t("Add your phone number to complete your profile and make service coordination easier.", "Add your phone number to complete your profile and make service coordination easier."),
      [
        { text: t("Not now", "Not now"), style: "cancel" },
        { text: t("Add phone number", "Add phone number"), onPress: () => setSection("details") },
      ],
    );
  }, []);
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (section !== "menu") { setSection("menu"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [section]);
  const save = () => {
    onSave().then(() => {
      setSection("menu");
      localizedAlert("Profile saved", "Your worker profile has been saved to your account.");
    }).catch((error) => localizedAlert("Profile not saved", error instanceof Error ? error.message : "Please try again."));
  };

  if (section !== "menu") {
    if (section === "kyc") return <WorkerKycView workerId={workerId} onBack={() => setSection("menu")} />;
    const title = section === "details" ? "Personal details" : section === "services" ? "Skills & services" : section === "area" ? "Service area" : section === "availability" ? "Availability" : "Public profile preview";
    return <>
      <Pressable onPress={() => setSection("menu")} style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#102A43" /><Text style={styles.backText}>Worker profile</Text></Pressable>
      <View style={styles.workerForm}>
        <Text style={styles.formTitle}>{title}</Text>
        {section === "details" && <><Text style={styles.formLabel}>Display name</Text><TextInput value={profile.name} onChangeText={(value) => update({ name: value })} placeholder="Your name" placeholderTextColor="#829AB1" style={styles.formInput} /><Text style={styles.formLabel}>Phone number</Text><TextInput value={profile.phone} onChangeText={(value) => update({ phone: value })} placeholder="10-digit mobile number" keyboardType="phone-pad" placeholderTextColor="#829AB1" style={styles.formInput} /><Text style={styles.formLabel}>About your work</Text><TextInput value={profile.about} onChangeText={(value) => update({ about: value })} placeholder="Describe your experience" placeholderTextColor="#829AB1" multiline style={styles.formTextArea} /></>}
        {section === "services" && <><Text style={styles.formCopy}>Use commas to list the services customers can book.</Text><Text style={styles.formLabel}>Skills & services</Text><TextInput value={profile.services} onChangeText={(value) => update({ services: value })} placeholder="Plumber, Handyman" placeholderTextColor="#829AB1" multiline style={styles.formTextArea} /></>}
        {section === "area" && <><Text style={styles.formCopy}>Customers see this service area while choosing nearby help.</Text><Text style={styles.formLabel}>Service area</Text><TextInput value={profile.serviceArea} onChangeText={(value) => update({ serviceArea: value })} placeholder="Area and city" placeholderTextColor="#829AB1" style={styles.formInput} /><SecondaryButton label="Use my current location" icon="my-location" onPress={() => { void onUseCurrentArea(); }} /></>}
        {section === "availability" && <><Text style={styles.formCopy}>The Online switch on your dashboard controls immediate visibility.</Text><Text style={styles.formLabel}>Working hours</Text><TextInput value={profile.availability} onChangeText={(value) => update({ availability: value })} placeholder="Available today, 10:00 AM – 7:00 PM" placeholderTextColor="#829AB1" multiline style={styles.formTextArea} /></>}
        {section === "preview" && <View style={styles.profilePreview}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{initials(profile.name)}</Text></View><Text style={styles.identityName}>{profile.name}</Text><Text style={styles.identityCopy}>{profile.services || "Add your services"}</Text><Text style={styles.previewText}>{profile.serviceArea}</Text><Text style={styles.previewText}>{profile.availability}</Text><Text style={styles.previewAbout}>{profile.about}</Text></View>}
        {section !== "preview" && <PrimaryButton label="Save profile" icon="check" onPress={save} />}
      </View>
    </>;
  }

  return <><Intro title="Worker profile" copy="Keep your cooperative profile accurate and trustworthy." />{profile.phone.trim().replace(/\D/g, "").length < 10 && <Pressable onPress={() => setSection("details")} style={({ pressed }) => [styles.phoneAlertCard, pressed && styles.pressed]}><MaterialIcons name="phone" size={21} color="#B45309" /><View style={styles.flex}><Text style={styles.phoneAlertTitle}>{t("Add phone number", "Add phone number")}</Text><Text style={styles.phoneAlertCopy}>{t("Complete your profile to make service coordination easier.", "Complete your profile to make service coordination easier.")}</Text></View><MaterialIcons name="chevron-right" size={22} color="#B45309" /></Pressable>}{restricted && <View style={styles.lockedCard}><MaterialIcons name="lock" size={20} color="#C2410C" /><View style={styles.flex}><Text style={styles.lockedTitle}>Complete KYC to unlock your worker tools</Text><Text style={styles.lockedCopy}>Your dashboard, job actions, availability, and profile editing stay disabled until your identity is approved.</Text></View></View>}<View style={styles.workerIdentity}><View style={styles.profileIdentityMain}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{initials(profile.name)}</Text></View><View style={styles.profileIdentityDetails}><View style={styles.identityLine}><Text style={styles.identityName}>{profile.name}</Text><Text style={styles.achievementBadge}>{achievementBadge(jobs.filter((job) => job.status === "completed").length)}</Text></View><Text style={styles.identityCopy}>{profile.services || "Add your services"}</Text><View style={styles.profileInfoLine}><MaterialIcons name="location-on" size={14} color="#0F766E" /><Text style={styles.profileInfoText}>{profile.serviceArea}</Text></View><View style={styles.profileInfoLine}><MaterialIcons name="schedule" size={14} color="#0F766E" /><Text style={styles.profileInfoText}>{profile.availability}</Text></View></View></View><View style={styles.profileRatingBox}><Text style={styles.profileRatingValue}>4.9</Text><Text style={styles.profileRatingStars}>★★★★★</Text><Text style={styles.profileRatingCount}>128 reviews</Text></View></View><WorkerProfileAnalytics jobs={jobs} earnings={earnings} /><SettingsRow icon="person-outline" label="Personal details" onPress={() => setSection("details")} disabled={restricted} /><SettingsRow icon="build" label="Skills & services" onPress={() => setSection("services")} disabled={restricted} /><SettingsRow icon="location-on" label="Service area" onPress={() => setSection("area")} disabled={restricted} /><SettingsRow icon="schedule" label="Availability" onPress={() => setSection("availability")} disabled={restricted} /><SettingsRow icon="visibility" label="Public profile preview" onPress={() => setSection("preview")} disabled={restricted} /><ProfileLanguagePicker /><AppearanceSetting /><Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutRow, pressed && styles.pressed]}><MaterialIcons name="logout" size={20} color="#C2410C" /><Text style={styles.signOutText}>Sign out</Text></Pressable></>;
}

function WorkerKycView({ workerId, onBack, onSkip, mandatory = false }: { workerId?: string; onBack: () => void; onSkip?: () => void; mandatory?: boolean }) {
  const [kyc, setKyc] = useState<import("@/lib/gig/models").WorkerKyc | null>(null);
  const [idType, setIdType] = useState<"aadhaar" | "pan" | "driving_license" | "passport">("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [idUri, setIdUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [idMimeType, setIdMimeType] = useState<string | undefined>();
  const [selfieMimeType, setSelfieMimeType] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  useEffect(() => { if (!workerId) return undefined; try { return subscribeToWorkerKyc(workerId, setKyc); } catch { return undefined; } }, [workerId]);
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (mandatory && onSkip) { onSkip(); return true; }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [mandatory, onBack, onSkip]);
  const pick = async (kind: "id" | "selfie") => { try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 }); const asset = result.canceled ? undefined : result.assets[0]; if (asset?.uri) { setSubmitDone(false); if (kind === "id") { setIdUri(asset.uri); setIdMimeType(asset.mimeType); } else { setSelfieUri(asset.uri); setSelfieMimeType(asset.mimeType); } } } catch (error) { localizedAlert("Upload unavailable", error instanceof Error ? error.message : "Please choose the file again."); } };
  const submit = async () => { const normalizedId = idNumber.replace(/[^a-zA-Z0-9]/g, ""); if (status === "pending") { localizedAlert("KYC under review", "Your documents are already submitted. The worker dashboard will open only after an administrator approves your verification."); return; } if (!workerId || !idUri || !selfieUri || normalizedId.length < 4) { localizedAlert("Complete KYC details", "Upload your ID document and selfie, then enter your complete ID number."); return; } setBusy(true); try { const [idDocumentUrl, selfieUrl] = await Promise.all([uploadKycDocument(idUri, workerId, "id", idMimeType), uploadKycDocument(selfieUri, workerId, "selfie", selfieMimeType)]); await saveWorkerKyc({ workerId, idType, idNumberLast4: normalizedId.slice(-4), idDocumentUrl, selfieUrl }); setIdNumber(""); setSubmitDone(true); localizedAlert("KYC submitted", "Your documents are securely submitted for admin review."); } catch (error) { localizedAlert("KYC submission failed", error instanceof Error ? error.message : "Please try again."); } finally { setBusy(false); } };
  const status = kyc?.status ?? "not_submitted";
  const isAwaitingReview = status === "pending";
  const showSubmittedSuccess = submitDone && status === "pending";
  return <><View style={styles.kycTopRow}>{!mandatory && <Pressable onPress={onBack} style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#102A43" /><Text style={styles.backText}>Worker profile</Text></Pressable>}{mandatory && onSkip && <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip for now" style={({ pressed }) => [styles.kycSkip, pressed && styles.pressed]}><Text style={styles.kycSkipText}>Skip for now</Text></Pressable>}</View><View style={[styles.workerForm, styles.kycForm]}><View style={styles.kycFormHeader}><View style={styles.kycHeaderIcon}><MaterialIcons name="verified-user" size={22} color="#0F766E" /></View><View style={styles.flex}><Text style={styles.formTitle}>KYC verification</Text><Text style={styles.formCopy}>Verify your identity to become visible for bookings. Documents are private and visible only to authorized administrators.</Text></View></View><View style={styles.adminCallout}><MaterialIcons name="verified-user" size={23} color="#0F766E" /><View style={styles.flex}><Text style={styles.calloutTitle}>Status: {status.replaceAll("_", " ")}</Text><Text style={styles.calloutCopy}>{status === "approved" ? "Your identity is verified." : status === "rejected" || status === "needs_resubmission" ? (kyc?.rejectionReason || "Please update and resubmit your documents.") : "Submit clear documents for review."}</Text></View></View><Text style={styles.formLabel}>Identity document</Text><View style={styles.quickGrid}>{(["aadhaar", "pan", "driving_license", "passport"] as const).map((type) => <Pressable key={type} onPress={() => setIdType(type)} style={[styles.filterChip, idType === type && styles.filterChipActive]}><Text style={styles.filterText}>{type.replaceAll("_", " ")}</Text></Pressable>)}</View><Text style={styles.formLabel}>Full ID number</Text><TextInput value={idNumber} onChangeText={(value) => setIdNumber(value.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 32))} placeholder="Full ID number" autoCapitalize="characters" autoCorrect={false} placeholderTextColor="#829AB1" style={styles.formInput} />{showSubmittedSuccess && <View style={styles.kycSuccess}><MaterialIcons name="check-circle" size={22} color="#15803D" /><View style={styles.flex}><Text style={styles.kycSuccessTitle}>KYC submitted successfully</Text><Text style={styles.kycSuccessCopy}>Your documents are uploaded and waiting for admin approval. The worker dashboard will open automatically after approval.</Text></View></View>}<View style={styles.kycUploadGrid}><Pressable onPress={() => { void pick("id"); }} accessibilityRole="button" style={({ pressed }) => [styles.kycUploadCard, pressed && styles.pressed]}>{idUri ? <Image source={{ uri: idUri }} style={styles.kycThumbnail} /> : <View style={styles.kycUploadIcon}><MaterialIcons name="description" size={24} color="#0F766E" /></View>}<View style={styles.flex}><Text style={styles.kycUploadTitle}>{idUri ? "ID document selected" : "Upload ID document"}</Text><Text style={styles.kycUploadCopy}>{idUri ? "Ready to upload securely" : "Clear photo or scan"}</Text></View><MaterialIcons name={idUri ? "check-circle" : "chevron-right"} size={21} color={idUri ? "#15803D" : "#829AB1"} /></Pressable><Pressable onPress={() => { void pick("selfie"); }} accessibilityRole="button" style={({ pressed }) => [styles.kycUploadCard, pressed && styles.pressed]}>{selfieUri ? <Image source={{ uri: selfieUri }} style={styles.kycThumbnail} /> : <View style={styles.kycUploadIcon}><MaterialIcons name="portrait" size={25} color="#0F766E" /></View>}<View style={styles.flex}><Text style={styles.kycUploadTitle}>{selfieUri ? "Selfie selected" : "Passport-size photo / selfie"}</Text><Text style={styles.kycUploadCopy}>{selfieUri ? "Ready to upload securely" : "Use a clear front-facing photo"}</Text></View><MaterialIcons name={selfieUri ? "check-circle" : "chevron-right"} size={21} color={selfieUri ? "#15803D" : "#829AB1"} /></Pressable></View><PrimaryButton disabled={busy || status === "approved" || isAwaitingReview} label={busy ? "Uploading & submitting…" : status === "approved" ? "KYC approved" : showSubmittedSuccess ? "Submitted for review" : "Submit for verification"} icon="verified" onPress={() => { void submit(); }} /></View></>;
}

function achievementBadge(completedJobs: number) { if (completedJobs >= 100) return "Platinum"; if (completedJobs >= 50) return "Gold"; if (completedJobs >= 25) return "Silver"; return "Beginner"; }

function WorkerProfileAnalytics({ jobs, earnings }: { jobs: Job[]; earnings: number }) {
  const completed = jobs.filter((job) => job.status === "completed").length;
  const total = jobs.length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const levels = [0, 1, 0, 2, 1, 3, Math.min(4, Math.max(1, jobs.length))];
  return <View style={styles.profileAnalytics}><View style={styles.profileAnalyticsHead}><View><Text style={styles.analyticsTitle}>Performance overview</Text><Text style={styles.analyticsCopy}>Your work and earnings at a glance</Text></View><MaterialIcons name="insights" size={22} color="#0F766E" /></View><View style={styles.profileStatRow}><View><Text style={styles.profileStatValue}>{total}</Text><Text style={styles.profileStatLabel}>Total jobs</Text></View><View><Text style={styles.profileStatValue}>{completed}</Text><Text style={styles.profileStatLabel}>Completed</Text></View><View><Text style={styles.profileStatValue}>₹{earnings.toLocaleString("en-IN")}</Text><Text style={styles.profileStatLabel}>Today</Text></View></View><Text style={styles.profileMiniTitle}>7-day activity</Text><View style={styles.profileHeatmap}>{levels.map((level, index) => <View key={index} style={styles.profileHeatColumn}><View style={[styles.profileHeatBox, level > 0 && styles.heatmapLow, level > 1 && styles.heatmapMedium, level > 2 && styles.heatmapHigh, level > 3 && styles.heatmapPeak]} /><Text style={styles.heatmapLabel}>{["M", "T", "W", "T", "F", "S", "S"][index]}</Text></View>)}</View><View style={styles.profileAnalyticsFooter}><Text style={styles.analyticsFooterText}>{rate}% completion rate</Text><Text style={styles.analyticsFooterText}>★ 4.9 rating</Text></View></View>;
}

function Conversation({ job, user, onBack }: { job: Job; user?: AppUser; onBack: () => void }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  useEffect(() => {
    if (!user?.id || !job.customerId) return undefined;
    try {
      return subscribeToMessages(job.id, setMessages);
    } catch (error) {
      localizedAlert("Chat unavailable", error instanceof Error ? error.message : "Please try again shortly.");
      return undefined;
    }
  }, [job.customerId, job.id, user?.id]);
  const send = async () => {
    const message = text.trim();
    if (!message || !user?.id || !job.customerId || isSending) return;
    setIsSending(true);
    try {
      await sendBookingMessage({ chatId: job.id, senderId: user.id, receiverId: job.customerId, message, bookingStatus: job.status });
      setText("");
    } catch (error) {
      localizedAlert("Message not sent", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSending(false);
    }
  };
  return <View style={styles.chatPage}><Pressable onPress={onBack} style={({ pressed }) => [styles.chatHeader, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color="#102A43" /><View style={styles.chatPerson}><Text style={styles.chatName}>{job.customer}</Text><Text style={styles.chatStatus}>Booking {job.id} · {bookingStatusLabel(job.status)}</Text></View></Pressable><View style={styles.validChat}><MaterialIcons name="verified-user" size={17} color="#15803D" /><Text style={styles.validChatText}>Secure booking chat is active</Text></View><ScrollView contentContainerStyle={styles.messageStack}>{messages.length === 0 ? <Text style={styles.emptyCopy}>Send a message to coordinate this service.</Text> : messages.map((message) => { const mine = message.senderId === user?.id; return <View key={message.id} style={[styles.bubble, mine && styles.workerBubble]}><Text style={[styles.messageText, mine && styles.workerMessageText]}>{message.message}</Text><Text style={[styles.messageTime, mine && styles.workerMessageTime]}>{message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Now"}</Text></View>; })}</ScrollView><View style={styles.composer}><TextInput value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor="#829AB1" style={styles.composerInput} returnKeyType="send" onSubmitEditing={() => { void send(); }} /><Pressable onPress={() => { void send(); }} style={({ pressed }) => [styles.sendButton, (pressed || isSending) && styles.pressed]}><MaterialIcons name="send" size={19} color="#FFFFFF" /></Pressable></View></View>;
}

export function AdminOperations({ name, onSignOut }: { name: string; onSignOut: () => Promise<void> }) { const colors = useColors(); const { t } = useI18n(); const [view, setView] = useState<AdminView>("overview"); const [data, setData] = useState<AdminData>({ users: [], workers: [], bookings: [] }); const [kycItems, setKycItems] = useState<import("@/lib/gig/models").WorkerKyc[]>([]); useEffect(() => { try { return subscribeToAdminData(setData); } catch { return undefined; } }, []); useEffect(() => { try { return subscribeToAllWorkerKyc(setKycItems); } catch { return undefined; } }, []); useEffect(() => { if (Platform.OS !== "android") return undefined; const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (view !== "overview") { setView("overview"); return true; } return false; }); return () => subscription.remove(); }, [view]); return <View style={[styles.page, { backgroundColor: colors.background }]}><View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} ><View><Text style={styles.headerOverline}>{t("ADMIN PORTAL", "ADMIN PORTAL")}</Text><Text style={styles.headerTitle}>{name.split(" ")[0]} — {t("Overview", "Overview")}</Text></View><GlobalLanguagePicker /><Pressable onPress={onSignOut} style={({ pressed }) => [styles.headerLogout, pressed && styles.pressed]}><MaterialIcons name="logout" size={19} color="#0F766E" /></Pressable></View><ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>{view === "overview" && <AdminOverview data={data} kycItems={kycItems} onPressWorkers={() => setView("workers")} onPressKyc={() => setView("kyc")} onPressReports={() => setView("reports")} />}{view === "workers" && <AdminWorkers workers={data.workers} onOpenKyc={() => setView("kyc")} onBack={() => setView("overview")} />}{view === "kyc" && <AdminKycReview items={kycItems} reviewer={name} />}{view === "users" && <AdminUsers users={data.users} />}{view === "bookings" && <AdminBookings bookings={data.bookings} />}{view === "financials" && <AdminFinancials bookings={data.bookings} />}{view === "locations" && <AdminLocations workers={data.workers} bookings={data.bookings} />}{view === "reports" && <AdminReports />}{view === "settings" && <AdminSettings name={name} />}</ScrollView><AdminBottomNav active={view} onPress={setView} /></View>; }

function AdminBookingBarChart({ bookings }: { bookings: Booking[] }) {
  const statuses: { key: BookingStatus; label: string; color: string }[] = [
    { key: "pending", label: "Pending", color: "#D97706" },
    { key: "accepted", label: "Accepted", color: "#0F766E" },
    { key: "in_progress", label: "Active", color: "#2563EB" },
    { key: "completed", label: "Done", color: "#15803D" },
    { key: "cancelled", label: "Cancelled", color: "#C2410C" },
  ];
  const counts = statuses.map((status) => bookings.filter((booking) => booking.status === status.key).length);
  const maxCount = Math.max(1, ...counts);
  return <View style={styles.analyticsCard}>
    <View style={styles.analyticsHeader}><View><Text style={styles.analyticsTitle}>Booking pipeline</Text><Text style={styles.analyticsCopy}>Live bookings by status</Text></View><MaterialIcons name="bar-chart" size={22} color="#0F766E" /></View>
    {bookings.length === 0 ? <Text style={styles.chartEmpty}>No live booking data yet. The chart will populate as customers create bookings.</Text> : <View style={styles.chartRow}>{statuses.map((status, index) => <View key={status.key} style={styles.chartColumn}><Text style={styles.chartValue}>{counts[index]}</Text><View style={styles.chartTrack}><View style={[styles.chartBar, { height: `${Math.max(7, (counts[index] / maxCount) * 100)}%`, backgroundColor: status.color }]} /></View><Text style={styles.chartLabel}>{status.label}</Text></View>)}</View>}
    <Text style={styles.chartFootnote}>Count: {bookings.length} total booking{bookings.length === 1 ? "" : "s"}</Text>
  </View>;
}

function AdminWorkerScatterPlot({ workers, bookings }: { workers: AdminData["workers"]; bookings: Booking[] }) {
  const points = workers.map((worker, index) => {
    const workerBookings = bookings.filter((booking) => booking.workerId === worker.userId || booking.workerId === worker.id);
    return { id: worker.id, name: worker.name, total: workerBookings.length, completed: workerBookings.filter((booking) => booking.status === "completed").length, color: ["#0F766E", "#2563EB", "#D97706", "#7C3AED", "#15803D"][index % 5] };
  });
  const maxTotal = Math.max(1, ...points.map((point) => point.total));
  const maxCompleted = Math.max(1, ...points.map((point) => point.completed));
  return <View style={styles.analyticsCard}>
    <View style={styles.analyticsHeader}><View><Text style={styles.analyticsTitle}>Worker performance</Text><Text style={styles.analyticsCopy}>Completed jobs compared with total bookings</Text></View><MaterialIcons name="scatter-plot" size={22} color="#0F766E" /></View>
    {points.length === 0 ? <Text style={styles.chartEmpty}>No worker data yet. Performance points will appear after workers receive bookings.</Text> : <><View style={styles.scatterPlot}><View style={[styles.scatterGridLine, styles.scatterGridLineTop]} /><View style={[styles.scatterGridLine, styles.scatterGridLineMiddle]} /><View style={styles.scatterAxisVertical} />{points.map((point) => <View key={point.id} style={[styles.scatterPoint, { backgroundColor: point.color, left: `${10 + (point.total / maxTotal) * 78}%`, bottom: `${10 + (point.completed / maxCompleted) * 70}%` }]} />)}</View><View style={styles.scatterAxisRow}><Text style={styles.scatterAxisLabel}>0 bookings</Text><Text style={styles.scatterAxisLabel}>Total bookings →</Text><Text style={styles.scatterAxisLabel}>{maxTotal} bookings</Text></View><View style={styles.scatterLegend}>{points.slice(0, 5).map((point) => <View key={point.id} style={styles.scatterLegendItem}><View style={[styles.scatterLegendDot, { backgroundColor: point.color }]} /><Text numberOfLines={1} style={styles.scatterLegendText}>{point.name} · {point.completed}/{point.total}</Text></View>)}</View><Text style={styles.chartFootnote}>Each point shows completed jobs / total bookings</Text></>}
  </View>;
}

function AdminOverview({ data, kycItems, onPressWorkers, onPressKyc, onPressReports }: { data: AdminData; kycItems: import("@/lib/gig/models").WorkerKyc[]; onPressWorkers: () => void; onPressKyc: () => void; onPressReports: () => void }) {
  const pending = data.bookings.filter((booking) => booking.status === "pending").length;
  const completed = data.bookings.filter((booking) => booking.status === "completed").length;
  const customers = data.users.filter((user) => user.role === "customer").length;
  const workers = data.users.filter((user) => user.role === "worker").length;
  const pendingKyc = kycItems.filter((item) => item.status === "pending" || item.status === "needs_resubmission").length;
  const notSubmitted = data.workers.filter((worker) => !kycItems.some((item) => item.workerId === worker.userId)).length;
  return <>
    <Intro title="Platform health" copy="Live operational data from the cooperative marketplace." />
    <View style={styles.adminMetricGrid}><Metric icon="groups" label="Customers" value={String(customers)} accent="#0F766E" /><Metric icon="engineering" label="Workers" value={String(workers)} accent="#15803D" onPress={onPressWorkers} /><Metric icon="event-note" label="Bookings" value={String(data.bookings.length)} accent="#D97706" /><Metric icon="pending-actions" label="Pending jobs" value={String(pending)} accent="#C2410C" /></View>
    <Section title="Worker activity" action="Open workers" onPress={onPressWorkers} />
    <View style={styles.adminCallout}><View style={styles.calloutIcon}><MaterialIcons name="verified-user" size={25} color="#D97706" /></View><View style={styles.flex}><Text style={styles.calloutTitle}>{data.workers.length} worker{data.workers.length === 1 ? "" : "s"} registered</Text><Text style={styles.calloutCopy}>Workers can publish their service profiles and appear in the nearby directory without identity approval.</Text></View></View>
    <AdminBookingBarChart bookings={data.bookings} />
    <AdminWorkerScatterPlot workers={data.workers} bookings={data.bookings} />
    <Section title="Current activity" action="Open reports" onPress={onPressReports} />
    <View style={styles.activityCard}><Activity icon="event-available" title={`${pending} pending booking requests`} time="Live" /><Activity icon="task-alt" title={`${completed} completed bookings`} time="Live" /><Activity icon="groups" title={`${data.users.length} registered accounts`} time="Live" /></View>
  </>;
}

function AdminWorkers({ workers, onOpenKyc, onBack }: { workers: AdminData["workers"]; onOpenKyc: () => void; onBack: () => void }) { const people = workers.map((worker) => ({ name: worker.name, skill: worker.services.join(" · ") || "Service worker", area: worker.serviceArea || "Area not provided", isVerified: worker.isVerified })); return <><Pressable onPress={onBack} style={({ pressed }) => [styles.adminBackRow, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#102A43" /><Text style={styles.backText}>Overview</Text></Pressable><Intro title="Worker verification" copy="Verification is completed from submitted KYC documents." /><View style={styles.stack}>{people.length === 0 ? <EmptyState icon="engineering" title="No worker profiles yet" copy="Worker profiles will appear here after registration." /> : people.map((person) => <View key={person.name} style={styles.verificationCard}><View style={styles.identityLine}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{initials(person.name)}</Text></View><View style={styles.flex}><Text style={styles.verificationName}>{person.name}</Text><Text style={styles.verificationCopy}>{person.skill}</Text><Text style={styles.verificationCopy}>{person.area}</Text></View><Status status={person.isVerified ? "verified" : "pending"} /></View><View style={styles.verifyActions}><SecondaryButton label="Open KYC review" icon="verified-user" onPress={onOpenKyc} /></View></View>)}</View></>;
}

function AdminKycReview({ items, reviewer }: { items: import("@/lib/gig/models").WorkerKyc[]; reviewer: string }) { const review = async (item: import("@/lib/gig/models").WorkerKyc, status: "approved" | "needs_resubmission") => { try { await reviewWorkerKyc(item.workerId, status, reviewer, status === "needs_resubmission" ? "Please upload clearer identity documents and selfie." : undefined); localizedAlert(status === "approved" ? "KYC approved" : "Resubmission requested", status === "approved" ? "Worker verification is complete and the worker is now discoverable." : "Worker must submit clearer documents."); } catch (error) { localizedAlert("KYC update failed", error instanceof Error ? error.message : "Please try again."); } }; const pending = items.filter((item) => item.status === "pending" || item.status === "needs_resubmission"); return <><Intro title="Worker KYC review" copy="Open both uploaded documents, then approve or request a clearer submission." />{pending.length === 0 ? <EmptyState icon="verified-user" title="No KYC submissions" copy="Pending worker identity documents will appear here." /> : <View style={styles.stack}>{pending.map((item) => <View style={styles.bookingAdminCard} key={item.workerId}><View style={styles.bookingAdminHead}><Text style={styles.adminBookingService}>{item.workerId}</Text><Status status={item.status} /></View><Text style={styles.adminBookingPeople}>ID type: {item.idType || "Not provided"} · ending {item.idNumberLast4 || "—"}</Text><Text style={styles.adminBookingPeople}>Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Not available"}</Text><View style={styles.kycDocumentActions}>{item.idDocumentUrl && <SecondaryButton label="Open ID" icon="description" onPress={() => { if (item.idDocumentUrl) void openKycDocument(item.idDocumentUrl); }} />}{item.selfieUrl && <SecondaryButton label="Open selfie" icon="portrait" onPress={() => { if (item.selfieUrl) void openKycDocument(item.selfieUrl); }} />}</View><View style={styles.verifyActions}><SecondaryButton label="Request resubmission" icon="refresh" onPress={() => { void review(item, "needs_resubmission"); }} /><PrimaryButton label="Approve KYC" icon="verified" onPress={() => { void review(item, "approved"); }} /></View></View>)}</View>}</>; }

function AdminUsers({ users }: { users: AdminData["users"] }) { return <><Intro title="Users" copy="View registered clients and their service history." /><View style={styles.stack}>{users.filter((user) => user.role === "customer").map((user) => <View style={styles.bookingAdminCard} key={user.id}><Text style={styles.adminBookingService}>{user.name || "Unnamed user"}</Text><Text style={styles.adminBookingPeople}>{user.email}</Text><Text style={styles.verificationCopy}>{user.address || "No address provided"}</Text></View>)}</View></>; }
function AdminFinancials({ bookings }: { bookings: AdminData["bookings"] }) { const completed = bookings.filter((booking) => booking.status === "completed"); const total = completed.reduce((sum, booking) => sum + (Number.isFinite(booking.price) ? booking.price : 0), 0); return <><Intro title="Financials" copy="Live earnings calculated from completed bookings." /><View style={styles.adminMetricGrid}><Metric icon="payments" label="Completed value" value={`₹${total.toLocaleString("en-IN")}`} accent="#0F766E" /><Metric icon="event-note" label="Completed bookings" value={String(completed.length)} accent="#15803D" /><Metric icon="account-balance-wallet" label="Payouts due" value="Not available" accent="#D97706" /><Metric icon="receipt-long" label="Transactions" value={String(bookings.length)} accent="#C2410C" /></View><Section title="Transaction summary" /><View style={styles.adminCallout}><View style={styles.calloutIcon}><MaterialIcons name="account-balance" size={24} color="#0F766E" /></View><View style={styles.flex}><Text style={styles.calloutTitle}>{completed.length} completed transactions recorded</Text><Text style={styles.calloutCopy}>Totals use only live Firestore booking prices; no demo values are shown.</Text></View></View></>; }
function AdminLocations({ workers, bookings }: { workers: AdminData["workers"]; bookings: AdminData["bookings"] }) { const areas = new Map<string, number>(); workers.forEach((worker) => { const area = worker.serviceArea || "Area not provided"; areas.set(area, (areas.get(area) || 0) + 1); }); return <><Intro title="Locations" copy="Monitor live worker areas and service demand." /><View style={styles.mapPlaceholder}><MaterialIcons name="map" size={36} color="#0F766E" /><Text style={styles.calloutTitle}>Live service map</Text><Text style={styles.calloutCopy}>{workers.filter((worker) => worker.location).length} workers have location data and {bookings.length} bookings are recorded.</Text></View><View style={styles.stack}><View style={styles.bookingAdminCard}><Text style={styles.adminBookingService}>Worker service areas</Text>{Array.from(areas.entries()).map(([area, count]) => <Text style={styles.adminBookingPeople} key={area}>{area} · {count} worker{count === 1 ? "" : "s"}</Text>)}</View></View></>; }
function AdminSettings({ name }: { name: string }) { return <><Intro title="Admin personal details" copy="Manage administrator profile and account settings." /><View style={styles.bookingAdminCard}><Text style={styles.adminBookingService}>{name}</Text><Text style={styles.adminBookingPeople}>Administrator account</Text><Text style={styles.adminBookingPeople}>Role-protected access enabled</Text></View><SettingsRow icon="security" label="Security and authorization" onPress={() => localizedAlert("Security", "Admin access is restricted to provisioned administrator accounts.")} /><SettingsRow icon="notifications" label="Notification preferences" onPress={() => localizedAlert("Notifications", "Admin alerts are enabled for new workers, reports, and payment issues.")} /><AppearanceSetting /></>; }
function AdminBookings({ bookings }: { bookings: AdminData["bookings"] }) { return <><Intro title="Bookings" copy="Monitor live marketplace work orders." /><View style={styles.stack}>{bookings.map((booking) => <View style={styles.bookingAdminCard} key={booking.id}><View style={styles.bookingAdminHead}><Text style={styles.adminBookingId}>{booking.id}</Text><Status status={booking.status} /></View><Text style={styles.adminBookingService}>{booking.serviceName}</Text><Text style={styles.adminBookingPeople}>{booking.customerName || booking.customerId} ↔ {booking.workerName || booking.workerId}</Text><Text style={styles.adminBookingPeople}>{booking.location?.address || "Location not provided"} · ₹{booking.price}</Text></View>)}</View></>; }

function AdminReports() { return <><Intro title="Complaints & reports" copy="Resolve concerns fairly using live moderation records." /><EmptyState icon="flag" title="No reports available" copy="Reports will appear here when they are stored in the reports collection." /></>; }

function WorkerBottomNav({ active, onPress }: { active: WorkerView; onPress: (view: WorkerView) => void }) { const tabs: { label: string; view: WorkerView; icon: keyof typeof MaterialIcons.glyphMap }[] = [{ label: "Dashboard", view: "dashboard", icon: "space-dashboard" }, { label: "Requests", view: "requests", icon: "inbox" }, { label: "Jobs", view: "jobs", icon: "work-outline" }, { label: "Profile", view: "profile", icon: "person" }]; return <BottomNav tabs={tabs} active={active} onPress={onPress} />; }
function AdminBottomNav({ active, onPress }: { active: AdminView; onPress: (view: AdminView) => void }) { const tabs: { label: string; view: AdminView; icon: keyof typeof MaterialIcons.glyphMap }[] = [{ label: "Overview", view: "overview", icon: "insights" }, { label: "Workers", view: "workers", icon: "engineering" }, { label: "Users", view: "users", icon: "groups" }, { label: "Bookings", view: "bookings", icon: "event-note" }, { label: "Finance", view: "financials", icon: "payments" }, { label: "Locations", view: "locations", icon: "map" }, { label: "Reports", view: "reports", icon: "flag" }, { label: "Settings", view: "settings", icon: "settings" }]; return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminNavScroll}><BottomNav tabs={tabs} active={active} onPress={onPress} /></ScrollView>; }
function BottomNav<T extends string>({ tabs, active, onPress }: { tabs: { label: string; view: T; icon: keyof typeof MaterialIcons.glyphMap }[]; active: T; onPress: (view: T) => void }) { return <View style={styles.bottomNav}>{tabs.map((tab) => { const selected = active === tab.view; return <Pressable key={tab.label} onPress={() => onPress(tab.view)} style={({ pressed }) => [styles.navTab, pressed && styles.pressed]}><MaterialIcons name={tab.icon} size={22} color={selected ? "#0F766E" : "#627D98"} /><Text style={[styles.navLabel, selected && styles.navLabelActive]}>{tab.label}</Text></Pressable>; })}</View>; }
function Intro({ title, copy }: { title: string; copy: string }) { return <View style={styles.intro}><Text style={styles.introTitle}>{title}</Text><Text style={styles.introCopy}>{copy}</Text></View>; }
function Section({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress} style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}><Text style={styles.actionLinkText}>{action}</Text><MaterialIcons name="chevron-right" size={18} color="#0F766E" /></Pressable>}</View>; }
function Metric({ icon, label, value, accent, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; accent: string; onPress?: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.metric, pressed && onPress && styles.pressed]}><View style={[styles.metricIcon, { backgroundColor: `${accent}16` }]}><MaterialIcons name={icon} size={20} color={accent} /></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Pressable>; }
function QuickAction({ icon, label, badge, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; badge?: number; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><View style={styles.quickIcon}><MaterialIcons name={icon} size={22} color="#0F766E" />{badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}</View><Text style={styles.quickLabel}>{label}</Text></Pressable>; }
function JobHeader({ job }: { job: Job }) { return <><View style={styles.jobTop}><View><Text style={styles.jobService}>{job.service}</Text><Text style={styles.jobCustomer}>{job.customer}</Text></View><Status status={job.status} /></View><Info icon="calendar-today" text={job.schedule} /><Info icon="location-on" text={job.address} /><Info icon="payments" text={`Starting at ₹${job.amount}`} /></>; }
function Info({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) { return <View style={styles.info}><MaterialIcons name={icon} size={16} color="#627D98" /><Text style={styles.infoText}>{text}</Text></View>; }
function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.primaryDisabled, pressed && !disabled && styles.primaryPressed]}><Text style={styles.primaryText}>{label}</Text><MaterialIcons name={icon} size={19} color="#FFFFFF" /></Pressable>; }
function SecondaryButton({ label, icon, onPress, danger }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void; danger?: boolean }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, danger && styles.secondaryDanger, pressed && styles.pressed]}><MaterialIcons name={icon} size={18} color={danger ? "#C2410C" : "#0F766E"} /><Text style={[styles.secondaryText, danger && styles.secondaryDangerText]}>{label}</Text></Pressable>; }
function Status({ status }: { status: string }) { const value = status.toLowerCase(); const color = value === "completed" || value === "verified" ? "#15803D" : value === "pending" || value === "in review" ? "#D97706" : value === "rejected" ? "#C2410C" : "#0F766E"; const label = value.includes("_") ? bookingStatusLabel(value as BookingStatus) : status; return <View style={[styles.status, { backgroundColor: `${color}16` }]}><Text style={[styles.statusText, { color }]}>{label}</Text></View>; }
function EmptyState({ icon, title, copy }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; copy: string }) { return <View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name={icon} size={28} color="#0F766E" /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{copy}</Text></View>; }
function bookingToJob(booking: Booking): Job { const customerName = (booking as Booking & { customerName?: unknown }).customerName; return { id: booking.id, customer: typeof customerName === "string" && customerName.trim() ? customerName : "Customer", customerId: booking.customerId, customerPhone: booking.customerPhone, service: booking.serviceName, schedule: `${booking.date} · ${booking.time}`, address: booking.location.address, amount: booking.price, status: booking.status, note: booking.description || "No additional work description was provided." }; }
function SettingsRow({ icon, label, onPress, disabled = false }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [styles.settings, disabled && styles.settingsDisabled, pressed && !disabled && styles.pressed]}><MaterialIcons name={icon} size={20} color={disabled ? "#A8B7C7" : "#0F766E"} /><Text style={[styles.settingsLabel, disabled && styles.settingsLabelDisabled]}>{label}</Text><MaterialIcons name="chevron-right" size={22} color={disabled ? "#C3CED9" : "#829AB1"} /></Pressable>; }
function Activity({ icon, title, time }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; time: string }) { return <View style={styles.activity}><View style={styles.activityIcon}><MaterialIcons name={icon} size={18} color="#0F766E" /></View><View style={styles.flex}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.activityTime}>{time}</Text></View></View>; }
async function openPrivateCall(phone?: string) { const digits = phone?.replace(/\D/g, "") ?? ""; if (digits.length < 10) { localizedAlert("Phone number unavailable", "This customer has not saved a valid contact number yet. Ask them to add it in their customer profile."); return; } const dialablePhone = phone?.trim().startsWith("+") ? `+${digits}` : digits.length === 10 ? `+91${digits}` : `+${digits}`; try { await Linking.openURL(`tel:${dialablePhone}`); } catch (error) { localizedAlert("Calling unavailable", error instanceof Error ? error.message : "A phone app is not available on this device. Try the call from a physical phone."); } }
async function openKycDocument(url: string) { try { if (!(await Linking.canOpenURL(url))) throw new Error("This document link is not available on the device."); await Linking.openURL(url); } catch (error) { localizedAlert("Document unavailable", error instanceof Error ? error.message : "Please try opening the document again."); } }
function initials(value: string) { return value.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

const styles = StyleSheet.create({
  phoneAlertCard: { alignItems: "center", backgroundColor: "#FFFBEB", borderColor: "#FCD34D", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 13 }, phoneAlertTitle: { color: "#92400E", fontSize: 14, fontWeight: "800" }, phoneAlertCopy: { color: "#A16207", fontSize: 12, lineHeight: 17, marginTop: 3 },
  kycTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingLeft: 0, paddingRight: 4, paddingTop: 2 },
  kycSkip: { paddingHorizontal: 6, paddingVertical: 4 },
  kycSkipText: { color: "#627D98", fontSize: 11, fontWeight: "700", textDecorationLine: "underline" },
  lockedCard: { alignItems: "flex-start", backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, marginBottom: 12, padding: 14 },
  lockedTitle: { color: "#9A3412", fontSize: 13, fontWeight: "800" },
  lockedCopy: { color: "#9A3412", fontSize: 11, lineHeight: 17, marginTop: 3 },
  achievementBadge: { backgroundColor: "#FEF3C7", borderRadius: 9, color: "#92400E", fontSize: 10, fontWeight: "800", marginLeft: 5, paddingHorizontal: 6, paddingVertical: 3 },
  backRow: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, minHeight: 42, marginBottom: 8, paddingLeft: 0, paddingRight: 10 },
  backText: { color: "#102A43", fontSize: 14, fontWeight: "800" },
  adminBackRow: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 7, minHeight: 42, marginBottom: 8, paddingRight: 12 },
  workerForm: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, gap: 10, padding: 16 }, kycForm: { gap: 14, padding: 18 }, kycFormHeader: { alignItems: "flex-start", flexDirection: "row", gap: 11 }, kycHeaderIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  skillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { backgroundColor: "#F1F5F9", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  skillText: { color: "#334E68", fontSize: 11, fontWeight: "700" },
  filterChip: { backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  filterChipActive: { backgroundColor: "#CCFBF1" },
  filterText: { color: "#334E68", fontSize: 11, fontWeight: "700" },
  formTitle: { color: "#102A43", fontSize: 19, fontWeight: "800", marginBottom: 4 },
  formLabel: { color: "#334E68", fontSize: 12, fontWeight: "800" },
  formCopy: { color: "#627D98", fontSize: 12, lineHeight: 18, marginBottom: 4 },
  formInput: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, color: "#102A43", fontSize: 14, height: 48, marginBottom: 5, paddingHorizontal: 13 }, kycUploadGrid: { gap: 10, marginTop: 1 }, kycUploadCard: { alignItems: "center", backgroundColor: "#FBFDFC", borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 11, minHeight: 68, paddingHorizontal: 12, paddingVertical: 10 }, kycUploadIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 14, height: 44, justifyContent: "center", width: 44 }, kycUploadIconSelected: { backgroundColor: "#DCFCE7" }, kycThumbnail: { borderRadius: 12, height: 44, width: 44 }, kycSuccess: { alignItems: "flex-start", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 }, kycSuccessTitle: { color: "#166534", fontSize: 12, fontWeight: "800" }, kycSuccessCopy: { color: "#166534", fontSize: 10, lineHeight: 16, marginTop: 3 }, kycUploadTitle: { color: "#334E68", fontSize: 12, fontWeight: "800" }, kycUploadCopy: { color: "#829AB1", fontSize: 10, marginTop: 3 },
  formTextArea: { backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 12, borderWidth: 1, color: "#102A43", fontSize: 14, lineHeight: 20, minHeight: 88, padding: 13, textAlignVertical: "top" },
  profilePreview: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 14, borderWidth: 1, gap: 6, padding: 18 },
  previewText: { color: "#486581", fontSize: 12, textAlign: "center" },
  previewAbout: { color: "#334E68", fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: "center" },
  page: { flex: 1, backgroundColor: "#F7F8F6" }, flex: { flex: 1 }, pressed: { opacity: 0.72 }, primaryPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 72, paddingHorizontal: 20 }, headerOverline: { color: "#0F766E", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, headerTitle: { color: "#102A43", fontSize: 24, fontWeight: "800", letterSpacing: -0.6, marginTop: 3 }, headerLogout: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, height: 38, justifyContent: "center", width: 38 }, onlineWrap: { alignItems: "center", flexDirection: "row", gap: 5 }, onlineDot: { borderRadius: 4, height: 7, width: 7 }, onlineLabel: { color: "#334E68", fontSize: 11, fontWeight: "800" }, scroll: { padding: 20, paddingBottom: 108 },   analyticsCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, marginTop: 16, padding: 15 },
  analyticsHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  analyticsTitle: { color: "#102A43", fontSize: 15, fontWeight: "800" },
  analyticsCopy: { color: "#829AB1", fontSize: 11, marginTop: 3 },
  analyticsBadge: { backgroundColor: "#E6FFFA", borderRadius: 12, color: "#0F766E", fontSize: 11, fontWeight: "800", paddingHorizontal: 9, paddingVertical: 6 },
  analyticsLink: { color: "#0F766E", fontSize: 11, fontWeight: "800", paddingVertical: 5 },
  heatmapRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  heatmapColumn: { alignItems: "center", gap: 6 },
  heatmapBox: { backgroundColor: "#EDF2F7", borderRadius: 6, height: 26, width: 26 },
  heatmapLow: { backgroundColor: "#BCEBE3" },
  heatmapMedium: { backgroundColor: "#70D5C5" },
  heatmapHigh: { backgroundColor: "#2AAE9B" },
  heatmapPeak: { backgroundColor: "#0F766E" },
  heatmapLabel: { color: "#829AB1", fontSize: 10, fontWeight: "700" },
  analyticsFooter: { borderTopColor: "#EAF0F5", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 11 },
  analyticsFooterText: { color: "#486581", fontSize: 11, fontWeight: "700" },
  chartRow: { alignItems: "flex-end", flexDirection: "row", height: 142, justifyContent: "space-around", marginTop: 12 },
  chartColumn: { alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" },
  chartValue: { color: "#829AB1", fontSize: 9, marginBottom: 5 },
  chartTrack: { backgroundColor: "#E6FFFA", borderRadius: 7, height: 92, justifyContent: "flex-end", overflow: "hidden", width: 24 },
  chartBar: { backgroundColor: "#0F766E", borderRadius: 7, minHeight: 20, width: "100%" },
  chartLabel: { color: "#829AB1", fontSize: 10, fontWeight: "700", marginTop: 7 },
  chartEmpty: { color: "#627D98", fontSize: 12, lineHeight: 18, marginTop: 18 },
  chartFootnote: { color: "#829AB1", fontSize: 10, marginTop: 10 },
  scatterPlot: { backgroundColor: "#FBFDFC", borderColor: "#E6FFFA", borderRadius: 12, borderWidth: 1, height: 148, marginTop: 16, overflow: "hidden", position: "relative" },
  scatterGridLine: { borderTopColor: "#D9E2EC", borderTopWidth: 1, left: "8%", position: "absolute", right: "8%" },
  scatterGridLineTop: { top: "22%" },
  scatterGridLineMiddle: { top: "55%" },
  scatterAxisVertical: { borderLeftColor: "#BCCCDC", borderLeftWidth: 1, bottom: "8%", left: "8%", position: "absolute", top: "8%" },
  scatterPoint: { borderColor: "#FFFFFF", borderRadius: 7, borderWidth: 2, height: 14, position: "absolute", width: 14 },
  scatterAxisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  scatterAxisLabel: { color: "#829AB1", fontSize: 9, fontWeight: "700" },
  scatterLegend: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  scatterLegendItem: { alignItems: "center", flexDirection: "row", maxWidth: "48%", gap: 4 },
  scatterLegendDot: { borderRadius: 4, height: 8, width: 8 },
  scatterLegendText: { color: "#486581", flexShrink: 1, fontSize: 9 },
  kycDocumentActions: { flexDirection: "row", gap: 9, marginTop: 12 },
  mapPlaceholder: { alignItems: "center", backgroundColor: "#E6FFFA", borderColor: "#99F6E4", borderRadius: 18, borderWidth: 1, gap: 7, marginTop: 16, padding: 26 },
  adminNavScroll: { backgroundColor: "#FFFFFF" },
  availabilityCard: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 12, padding: 15 }, availabilityCardOffline: { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }, availabilityIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, availabilityTitle: { color: "#102A43", fontSize: 14, fontWeight: "800" }, availabilityCopy: { color: "#486581", fontSize: 12, lineHeight: 18, marginTop: 3 }, metricGrid: { flexDirection: "row", gap: 9, marginTop: 14 }, adminMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 }, metric: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 15, borderWidth: 1, flex: 1, minHeight: 116, padding: 12 }, metricIcon: { alignItems: "center", borderRadius: 10, height: 34, justifyContent: "center", width: 34 }, metricValue: { color: "#102A43", fontSize: 18, fontWeight: "800", marginTop: 11 }, metricLabel: { color: "#627D98", fontSize: 11, fontWeight: "700", marginTop: 3 }, section: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12, marginTop: 27 }, sectionTitle: { color: "#102A43", fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }, actionLink: { alignItems: "center", flexDirection: "row" }, actionLinkText: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, nextJob: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 }, timeSquare: { alignItems: "center", backgroundColor: "#102A43", borderRadius: 12, height: 49, justifyContent: "center", width: 49 }, timeTop: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, timeBottom: { color: "#99F6E4", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 }, nextJobTitle: { color: "#102A43", fontSize: 14, fontWeight: "800" }, nextJobCopy: { color: "#627D98", fontSize: 12, marginTop: 4 }, quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, quickAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 15, borderWidth: 1, gap: 8, minHeight: 104, padding: 13, width: "47.8%" }, quickIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 12, height: 40, justifyContent: "center", position: "relative", width: 40 }, badge: { alignItems: "center", backgroundColor: "#C2410C", borderColor: "#FFFFFF", borderRadius: 9, borderWidth: 1.5, height: 18, justifyContent: "center", position: "absolute", right: -7, top: -7, width: 18 }, badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" }, quickLabel: { color: "#334E68", fontSize: 12, fontWeight: "800" }, intro: { marginBottom: 6, marginTop: 3 }, introTitle: { color: "#102A43", fontSize: 28, fontWeight: "800", letterSpacing: -0.7 }, introCopy: { color: "#627D98", fontSize: 14, lineHeight: 21, marginTop: 5 }, stack: { gap: 12 }, jobCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, padding: 15 }, jobTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 11 }, jobService: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, jobCustomer: { color: "#102A43", fontSize: 16, fontWeight: "800", marginTop: 3 }, status: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 }, statusText: { fontSize: 10, fontWeight: "800" }, info: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 6 }, infoText: { color: "#486581", fontSize: 12, flex: 1 }, jobNote: { color: "#486581", fontSize: 12, lineHeight: 18, marginTop: 13 }, jobActions: { flexDirection: "row", gap: 9, marginTop: 15 }, contactRow: { flexDirection: "row", gap: 9, marginBottom: 9, marginTop: 15 }, primaryButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 13, flex: 1, flexDirection: "row", gap: 7, height: 46, justifyContent: "center" }, primaryDisabled: { backgroundColor: "#94A3B8", opacity: 0.85 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, secondaryButton: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, height: 46, justifyContent: "center" }, secondaryDanger: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }, secondaryText: { color: "#0F766E", fontSize: 13, fontWeight: "800" }, secondaryDangerText: { color: "#C2410C" }, empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, marginTop: 20, padding: 28 }, emptyIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 20, height: 52, justifyContent: "center", width: 52 }, emptyTitle: { color: "#102A43", fontSize: 16, fontWeight: "800", marginTop: 13 }, emptyCopy: { color: "#627D98", fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "center" }, earningsHero: { backgroundColor: "#102A43", borderRadius: 19, marginTop: 18, padding: 20 }, earningsLabel: { color: "#99F6E4", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, earningsValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", letterSpacing: -0.9, marginTop: 8 }, earningsCopy: { color: "#BCCCDC", fontSize: 12, marginTop: 7 }, earningRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 11, padding: 13 }, earningIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 11, height: 39, justifyContent: "center", width: 39 }, earningTitle: { color: "#102A43", fontSize: 13, fontWeight: "800" }, earningCopy: { color: "#627D98", fontSize: 11, marginTop: 3 }, earningAmount: { color: "#15803D", fontSize: 14, fontWeight: "800" },   profileIdentityMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 12 },
  profileIdentityDetails: { flex: 1 },
  profileInfoLine: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 5 },
  profileInfoText: { color: "#627D98", flexShrink: 1, fontSize: 11 },
  profileRatingBox: { alignItems: "center", backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderRadius: 13, borderWidth: 1, minWidth: 82, paddingHorizontal: 8, paddingVertical: 9 },
  profileRatingValue: { color: "#9A3412", fontSize: 21, fontWeight: "900" },
  profileRatingStars: { color: "#D97706", fontSize: 11, letterSpacing: 1, marginTop: 2 },
  profileRatingCount: { color: "#9A3412", fontSize: 9, fontWeight: "700", marginTop: 3 },
  profileAnalytics: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, marginTop: 16, padding: 15 },
  profileAnalyticsHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  profileStatRow: { borderBottomColor: "#EAF0F5", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingBottom: 14 },
  profileStatValue: { color: "#102A43", fontSize: 18, fontWeight: "800" },
  profileStatLabel: { color: "#829AB1", fontSize: 10, fontWeight: "700", marginTop: 3 },
  profileMiniTitle: { color: "#486581", fontSize: 11, fontWeight: "800", marginTop: 14 },
  profileHeatmap: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  profileHeatColumn: { alignItems: "center", gap: 5 },
  profileHeatBox: { backgroundColor: "#EDF2F7", borderRadius: 5, height: 22, width: 22 },
  profileAnalyticsFooter: { borderTopColor: "#EAF0F5", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10 },
  workerIdentity: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 13, marginTop: 17, padding: 16 }, profileAvatar: { alignItems: "center", backgroundColor: "#CCE6E2", borderRadius: 23, height: 55, justifyContent: "center", width: 55 }, profileAvatarText: { color: "#0F766E", fontSize: 16, fontWeight: "800" }, identityLine: { alignItems: "center", flexDirection: "row", gap: 5 }, identityName: { color: "#102A43", fontSize: 17, fontWeight: "800" }, identityCopy: { color: "#627D98", fontSize: 12, marginTop: 3 }, ratingTiny: { color: "#D97706", fontSize: 12, fontWeight: "800", marginTop: 5 },   settings: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 10, minHeight: 55, paddingHorizontal: 14 }, settingsDisabled: { backgroundColor: "#F8FAFC", borderColor: "#E5E7EB", opacity: 0.72 }, settingsLabel: { color: "#334E68", flex: 1, fontSize: 13, fontWeight: "800" }, settingsLabelDisabled: { color: "#94A3B8" }, signOutRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 45, marginTop: 15, paddingHorizontal: 12 }, signOutText: { color: "#C2410C", fontSize: 13, fontWeight: "800" }, chatPage: { minHeight: 620 }, chatHeader: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 52 }, chatPerson: { flex: 1 }, chatName: { color: "#102A43", fontSize: 15, fontWeight: "800" }, chatStatus: { color: "#627D98", fontSize: 11, marginTop: 2 }, validChat: { alignItems: "center", alignSelf: "center", backgroundColor: "#F0FDF4", borderRadius: 14, flexDirection: "row", gap: 6, marginTop: 14, paddingHorizontal: 10, paddingVertical: 7 }, validChatText: { color: "#15803D", fontSize: 11, fontWeight: "800" }, messageStack: { gap: 10, marginTop: 20 }, bubble: { borderRadius: 15, maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 10 }, customerBubble: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderWidth: 1 }, workerBubble: { alignSelf: "flex-end", backgroundColor: "#0F766E" }, messageText: { color: "#334E68", fontSize: 13, lineHeight: 19 }, workerMessageText: { color: "#FFFFFF" }, messageTime: { color: "#829AB1", fontSize: 10, marginTop: 4 }, workerMessageTime: { color: "#CCFBF1" }, composer: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: "auto", padding: 7 }, composerInput: { color: "#102A43", flex: 1, fontSize: 13, minHeight: 38, paddingHorizontal: 8 }, sendButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, adminCallout: { alignItems: "flex-start", backgroundColor: "#FFF7ED", borderColor: "#FED7AA", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 12, padding: 15 }, calloutIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }, calloutTitle: { color: "#9A3412", fontSize: 14, fontWeight: "800" }, calloutCopy: { color: "#9A3412", fontSize: 12, lineHeight: 18, marginTop: 3 }, activityCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, gap: 14, padding: 15 }, activity: { alignItems: "center", flexDirection: "row", gap: 11 }, activityIcon: { alignItems: "center", backgroundColor: "#E6FFFA", borderRadius: 10, height: 36, justifyContent: "center", width: 36 }, activityTitle: { color: "#334E68", fontSize: 13, fontWeight: "800" }, activityTime: { color: "#829AB1", fontSize: 11, marginTop: 2 }, verificationCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 17, borderWidth: 1, padding: 14 }, smallAvatar: { alignItems: "center", backgroundColor: "#CCE6E2", borderRadius: 15, height: 43, justifyContent: "center", width: 43 }, smallAvatarText: { color: "#0F766E", fontSize: 13, fontWeight: "800" }, verificationName: { color: "#102A43", fontSize: 14, fontWeight: "800" }, verificationCopy: { color: "#627D98", fontSize: 11, marginTop: 2 }, verifyActions: { flexDirection: "row", gap: 9, marginTop: 14 }, bookingAdminCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, padding: 15 }, bookingAdminHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, adminBookingId: { color: "#0F766E", fontSize: 11, fontWeight: "800" }, adminBookingService: { color: "#102A43", fontSize: 16, fontWeight: "800", marginTop: 9 }, adminBookingPeople: { color: "#627D98", fontSize: 12, marginTop: 4 }, reportCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 11, padding: 14 }, reportIcon: { alignItems: "center", backgroundColor: "#FFF7ED", borderRadius: 11, height: 40, justifyContent: "center", width: 40 }, reportTitle: { color: "#102A43", fontSize: 13, fontWeight: "800" }, reportCopy: { color: "#627D98", fontSize: 11, marginTop: 3 }, reportStatus: { color: "#D97706", fontSize: 11, fontWeight: "800" }, bottomNav: { backgroundColor: "#FFFFFF", borderTopColor: "#D9E2EC", borderTopWidth: 1, bottom: 0, flexDirection: "row", height: 68, left: 0, paddingTop: 8, position: "absolute", right: 0 }, navTab: { alignItems: "center", flex: 1, gap: 3 }, navLabel: { color: "#627D98", fontSize: 10, fontWeight: "700" }, navLabelActive: { color: "#0F766E" },
});

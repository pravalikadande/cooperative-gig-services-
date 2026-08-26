import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CustomerMarketplace } from "@/components/gig/customer-marketplace";
import { AdminOperations, WorkerOperations } from "@/components/gig/operations";
import { useGigSession } from "@/lib/gig/session-context";
import type { UserRole } from "@/lib/gig/models";
import { PUBLIC_REGISTRATION_ROLES } from "@/lib/gig/registration";

type AuthMode = "welcome" | "login" | "register";

const roleCopy: Record<UserRole, { title: string; detail: string; icon: "person" | "handyman" | "admin-panel-settings" }> = {
  customer: { title: "Find trusted help", detail: "Book verified cooperative workers near you.", icon: "person" },
  worker: { title: "Grow your work", detail: "Receive fair local opportunities and manage jobs.", icon: "handyman" },
  admin: { title: "Manage the cooperative", detail: "Verify workers and oversee platform activity.", icon: "admin-panel-settings" },
};

export default function HomeScreen() {
  const { isLoading, user, signIn, resetPassword, updateProfile, signOut } = useGigSession();
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [selectedRole, setSelectedRole] = useState<UserRole>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Complete your details", "Enter your email address and password to continue.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      Alert.alert("Tell us your name", "Add your name so customers and workers can recognise you.");
      return;
    }
    try {
      await signIn({ name, email, password, role: selectedRole, isNew: mode === "register" });
    } catch (error) {
      Alert.alert("Account action could not be completed", error instanceof Error ? error.message : "Please review the details and try again.");
    }
  };

  if (isLoading) return <Splash />;
  if (user) return <SignedInShell name={user.name} role={user.role} onSaveProfile={updateProfile} onSignOut={signOut} />;

  if (mode === "welcome") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
        <View style={styles.welcome}>
          <BrandMark size="large" />
          <View style={styles.welcomeText}>
            <Text style={styles.eyebrow}>A FAIRER LOCAL MARKETPLACE</Text>
            <Text style={styles.heroCopy}>Find dependable cooperative workers, manage services, and keep every interaction in one safe place.</Text>
          </View>
          <View style={styles.welcomeActions}>
            <PrimaryButton label="Sign in" onPress={() => setMode("login")} />
            <Pressable onPress={() => setMode("register")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Create an account</Text>
            </Pressable>
            <Text style={styles.consentCopy}>By continuing, you agree to the cooperative community guidelines.</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const isRegister = mode === "register";
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setMode("welcome")} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <MaterialIcons name="arrow-back" size={21} color="#102A43" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.authHeader}>
            <BrandMark size="small" />
            <Text style={styles.authTitle}>{isRegister ? "Join your local cooperative" : "Welcome back"}</Text>
            <Text style={styles.authSubtitle}>{isRegister ? "Choose how you will use the platform." : "Sign in to continue managing your services."}</Text>
          </View>
          {isRegister && (
            <View style={styles.roleSection}>
              <Text style={styles.fieldLabel}>I am joining as</Text>
              <View style={styles.roleStack}>
                {PUBLIC_REGISTRATION_ROLES.map((role) => (
                  <RoleCard key={role} role={role} selected={selectedRole === role} onPress={() => setSelectedRole(role)} />
                ))}
              </View>
              <Text style={styles.roleHelp}>Administrator accounts are provisioned by the Firebase project owner.</Text>
            </View>
          )}
          <View style={styles.formCard}>
            {isRegister && <LabeledInput label="Full name" placeholder="Your name" value={name} onChangeText={setName} icon="person-outline" />}
            <LabeledInput label="Email address" placeholder="name@example.com" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" />
            <LabeledInput label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} icon="lock-outline" secureTextEntry />
            {!isRegister && (
              <Pressable onPress={async () => {
                if (!email.trim()) { Alert.alert("Enter your email", "Add your registered email address first, then try again."); return; }
                try { const sent = await resetPassword(email); Alert.alert("Password recovery", sent ? "A password-reset email has been sent." : "Firebase needs to be enabled before password reset is available."); } catch (error) { Alert.alert("Password recovery failed", error instanceof Error ? error.message : "Please try again."); }
              }} style={({ pressed }) => [styles.forgotLink, pressed && styles.pressed]}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}
            <PrimaryButton label={isRegister ? "Create account" : "Sign in"} onPress={submit} />
          </View>
          <Pressable onPress={() => setMode(isRegister ? "login" : "register")} style={({ pressed }) => [styles.switchAuth, pressed && styles.pressed]}>
            <Text style={styles.switchAuthText}>{isRegister ? "Already have an account? " : "New here? "}<Text style={styles.switchAuthStrong}>{isRegister ? "Sign in" : "Create one"}</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function Splash() {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <View style={styles.splash}>
        <BrandMark size="large" />
        <Text style={styles.splashTitle}>Cooperative Gig Services</Text>
        <Text style={styles.splashCopy}>Reliable local help, powered by people.</Text>
        <ActivityIndicator color="#0F766E" style={styles.loader} />
      </View>
    </ScreenContainer>
  );
}

function SignedInShell({ name, role, onSaveProfile, onSignOut }: { name: string; role: UserRole; onSaveProfile: (input: { name?: string; phone?: string; address?: string; workerProfile?: Record<string, unknown> }) => Promise<void>; onSignOut: () => Promise<void> }) {
  if (role === "customer") return <CustomerMarketplace name={name} onSaveProfile={onSaveProfile} onSignOut={onSignOut} />;
  if (role === "worker") return <WorkerOperations name={name} onSaveProfile={onSaveProfile} onSignOut={onSignOut} />;
  return <AdminOperations name={name} onSignOut={onSignOut} />;
}

function BrandMark({ size }: { size: "tiny" | "small" | "large" }) {
  const dimensions = size === "large" ? 92 : size === "small" ? 52 : 38;
  return <View style={[styles.brandMark, { width: dimensions, height: dimensions, borderRadius: dimensions * 0.32 }]}><MaterialIcons name="handshake" size={size === "large" ? 46 : size === "small" ? 28 : 21} color="#FFFFFF" /></View>;
}

function RoleCard({ role, selected, onPress }: { role: UserRole; selected: boolean; onPress: () => void }) {
  const copy = roleCopy[role];
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.roleCard, selected && styles.roleCardSelected, pressed && styles.pressed]}><View style={[styles.roleCardIcon, selected && styles.roleCardIconSelected]}><MaterialIcons name={copy.icon} size={22} color={selected ? "#0F766E" : "#627D98"} /></View><View style={styles.flex}><Text style={styles.roleCardTitle}>{copy.title}</Text><Text style={styles.roleCardDetail}>{copy.detail}</Text></View><MaterialIcons name={selected ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={selected ? "#0F766E" : "#9FB3C8"} /></Pressable>;
}

function LabeledInput({ label, icon, ...props }: { label: string; icon: keyof typeof MaterialIcons.glyphMap } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.inputGroup}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputWrap}><MaterialIcons name={icon} size={20} color="#627D98" /><TextInput placeholderTextColor="#829AB1" style={styles.input} autoCapitalize="none" {...props} /></View></View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}><Text style={styles.primaryButtonText}>{label}</Text><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  primaryPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  splash: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  splashTitle: { color: "#102A43", fontSize: 25, fontWeight: "800", letterSpacing: -0.6, marginTop: 24, textAlign: "center" },
  splashCopy: { color: "#627D98", fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "center" },
  loader: { marginTop: 40 },
  brandMark: { alignItems: "center", backgroundColor: "#0F766E", justifyContent: "center", shadowColor: "#0F766E", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 16 },
  welcome: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 30 },
  welcomeText: { marginTop: 44 },
  eyebrow: { color: "#0F766E", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#102A43", fontSize: 40, fontWeight: "800", letterSpacing: -1.4, lineHeight: 46, marginTop: 15 },
  heroCopy: { color: "#486581", fontSize: 16, lineHeight: 24, marginTop: 18, maxWidth: 330 },
  welcomeActions: { gap: 12 },
  primaryButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 16, flexDirection: "row", height: 56, justifyContent: "center", gap: 10 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: "#A8D5CE", borderRadius: 16, borderWidth: 1, height: 56, justifyContent: "center" },
  secondaryButtonText: { color: "#0F766E", fontSize: 16, fontWeight: "800" },
  consentCopy: { color: "#829AB1", fontSize: 12, lineHeight: 18, paddingHorizontal: 14, textAlign: "center" },
  authScroll: { flexGrow: 1, padding: 20, paddingBottom: 36 },
  backButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, minHeight: 44 },
  backText: { color: "#102A43", fontSize: 14, fontWeight: "700" },
  authHeader: { gap: 10, marginBottom: 24, marginTop: 20 },
  authTitle: { color: "#102A43", fontSize: 28, fontWeight: "800", letterSpacing: -0.7, marginTop: 10 },
  authSubtitle: { color: "#627D98", fontSize: 15, lineHeight: 22 },
  roleSection: { marginBottom: 18 },
  roleStack: { gap: 10, marginTop: 9 },
  roleHelp: { color: "#627D98", fontSize: 12, lineHeight: 18, marginTop: 10 },
  roleCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 72, padding: 12 },
  roleCardSelected: { backgroundColor: "#F0FDFA", borderColor: "#0F766E", borderWidth: 1.5 },
  roleCardIcon: { alignItems: "center", backgroundColor: "#F0F4F8", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  roleCardIconSelected: { backgroundColor: "#CCFBF1" },
  roleCardTitle: { color: "#102A43", fontSize: 14, fontWeight: "800" },
  roleCardDetail: { color: "#627D98", fontSize: 12, lineHeight: 17, marginTop: 2 },
  formCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 20, borderWidth: 1, gap: 16, padding: 18 },
  inputGroup: { gap: 7 },
  fieldLabel: { color: "#334E68", fontSize: 13, fontWeight: "800" },
  inputWrap: { alignItems: "center", backgroundColor: "#F7F8F6", borderColor: "#D9E2EC", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, height: 52, paddingHorizontal: 14 },
  input: { color: "#102A43", flex: 1, fontSize: 15, height: "100%" },
  forgotLink: { alignSelf: "flex-end", minHeight: 28, justifyContent: "center" },
  forgotText: { color: "#0F766E", fontSize: 13, fontWeight: "800" },
  switchAuth: { alignItems: "center", marginTop: 22, minHeight: 40, justifyContent: "center" },
  switchAuthText: { color: "#627D98", fontSize: 14 },
  switchAuthStrong: { color: "#0F766E", fontWeight: "800" },
  signedInPage: { flex: 1 },
  topbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 },
  signOutButton: { alignItems: "center", flexDirection: "row", gap: 6, minHeight: 44 },
  signOutText: { color: "#0F766E", fontSize: 13, fontWeight: "800" },
  dashboardScroll: { padding: 20, paddingBottom: 28 },
  dashboardGreeting: { marginTop: 14 },
  dashboardTitle: { color: "#102A43", fontSize: 31, fontWeight: "800", letterSpacing: -0.8, marginTop: 7 },
  dashboardCopy: { color: "#486581", fontSize: 15, lineHeight: 22, marginTop: 8 },
  roleSummary: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#D9E2EC", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 13, marginTop: 28, padding: 18 },
  roleIconWrap: { alignItems: "center", backgroundColor: "#CCFBF1", borderRadius: 14, height: 54, justifyContent: "center", width: 54 },
  roleSummaryTitle: { color: "#102A43", fontSize: 17, fontWeight: "800" },
  roleSummaryCopy: { color: "#627D98", fontSize: 13, lineHeight: 19, marginTop: 4 },
  readinessCard: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderRadius: 18, borderWidth: 1, marginTop: 14, padding: 18 },
  readinessTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  readinessTitle: { color: "#166534", fontSize: 14, fontWeight: "800" },
  readinessCopy: { color: "#3F6212", fontSize: 13, lineHeight: 19, marginTop: 9 },
  tabBar: { backgroundColor: "#FFFFFF", borderTopColor: "#D9E2EC", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-around", minHeight: 68, paddingHorizontal: 4, paddingTop: 8 },
  tabItem: { alignItems: "center", flex: 1, gap: 3, minHeight: 46 },
  tabLabel: { color: "#627D98", fontSize: 10, fontWeight: "700" },
  tabLabelActive: { color: "#0F766E" },
});

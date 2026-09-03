import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithCredential, signInWithPopup, signOut as signOutFromFirebase } from "firebase/auth";

import { firebaseAuth, isFirebaseConfigured } from "./firebase";
import { createFirebaseUserProfile, publishWorkerDirectoryProfile, readFirebaseUser, setWorkerDirectoryOnline, updateFirebaseUserProfile } from "./firebase-repository";
import { registerDeviceForFirebaseMessaging } from "./notifications";
import type { AppUser, UserRole } from "./models";
import { isPublicRegistrationRole } from "./registration";

WebBrowser.maybeCompleteAuthSession();

type SessionState = {
  isLoading: boolean;
  user: AppUser | null;
  signIn: (input: { name?: string; email: string; password: string; role: UserRole; isNew: boolean }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (input: { name?: string; phone?: string; address?: string; workerProfile?: Record<string, unknown> }) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);
const SESSION_KEY = "cooperative-gig-services/session";
const PROFILE_KEY_PREFIX = "cooperative-gig-services/profile/";
const ADMIN_EMAIL = "siddhardhar471@gmail.com";
const googleExtra = (Constants.expoConfig?.extra?.google ?? {}) as { androidClientId?: string; iosClientId?: string; webClientId?: string };
const googleAndroidClientId = googleExtra.androidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
const googleIosClientId = googleExtra.iosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const googleWebClientId = googleExtra.webClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const googleAuthConfigured = Platform.OS === "web" || Boolean(googleAndroidClientId || googleIosClientId);

function friendlyAccountError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "auth/email-already-in-use") return "This email already has an account. Choose Sign in instead.";
  if (code === "auth/invalid-email") return "Enter a valid email address, for example name@example.com.";
  if (code === "auth/weak-password") return "Use a password with at least 6 characters.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Email or password is incorrect. Check the details or use Forgot password.";
  if (code === "auth/too-many-requests") return "Too many sign-in attempts. Wait a few minutes, then try again or reset your password.";
  if (code === "auth/operation-not-allowed") return "Email/Password sign-in is not enabled in Firebase Authentication. Enable it in your Firebase project, then try again.";
  if (code === "auth/api-key-not-valid") return "Firebase API key is invalid. Verify the local .env Firebase configuration and restart Expo.";
  if (code === "auth/network-request-failed") return "Network connection failed. Check your internet connection and try again.";
  if (code === "permission-denied" || code === "firestore/permission-denied") return "Your Firebase account was created, but its profile could not be saved. Confirm that the Firestore Rules were published, then sign in again.";
  return error instanceof Error ? error.message : "Please review the details and try again.";
}

export function GigSessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    // Firebase signInWithPopup handles web auth directly; AuthSession still requires a defined value during hook initialization.
    webClientId: googleWebClientId || (Platform.OS === "web" ? "web-only-firebase-popup.apps.googleusercontent.com" : undefined),
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
  });

  const completeGoogleSignIn = async (firebaseUser: NonNullable<Parameters<typeof readFirebaseUser>[0]>) => {
    const existingProfile = await readFirebaseUser(firebaseUser);
    const nextUser = existingProfile ?? await createFirebaseUserProfile(firebaseUser, { name: firebaseUser.displayName ?? undefined, role: "customer" });
    setUser(nextUser);
    registerDeviceForFirebaseMessaging(nextUser.id).catch(() => undefined);
  };

  useEffect(() => {
    if (firebaseAuth && isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        try {
          const profile = firebaseUser ? await readFirebaseUser(firebaseUser) : null;
          const normalizedProfile = profile && firebaseUser?.email?.trim().toLowerCase() === ADMIN_EMAIL ? { ...profile, role: "admin" as const } : profile;
          if (normalizedProfile?.role === "worker") await publishWorkerDirectoryProfile(normalizedProfile);
          setUser(normalizedProfile);
          if (normalizedProfile) registerDeviceForFirebaseMessaging(normalizedProfile.id).catch(() => undefined);
        } finally {
          setIsLoading(false);
        }
      });
      return unsubscribe;
    }
    AsyncStorage.getItem(SESSION_KEY)
      .then(async (value) => {
        if (!value) return null;
        const sessionUser = JSON.parse(value) as AppUser;
        const savedProfile = await AsyncStorage.getItem(`${PROFILE_KEY_PREFIX}${sessionUser.id}`);
        return savedProfile ? { ...sessionUser, ...(JSON.parse(savedProfile) as Partial<AppUser>) } : sessionUser;
      })
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!googleResponse || googleResponse.type !== "success" || !firebaseAuth || !isFirebaseConfigured) return;
    const idToken = googleResponse.params?.id_token;
    const accessToken = googleResponse.authentication?.accessToken;
    if (!idToken) return;
    signInWithCredential(firebaseAuth, GoogleAuthProvider.credential(idToken, accessToken))
      .then((credential) => completeGoogleSignIn(credential.user))
      .catch((error) => { throw new Error(friendlyAccountError(error)); });
  }, [googleResponse]);

  const signInWithGoogle = async () => {
    if (!firebaseAuth || !isFirebaseConfigured) throw new Error("Configure Firebase before using Google sign-in.");
    if (Platform.OS !== "web" && !googleAuthConfigured) throw new Error("Google sign-in is not configured for this Android/iOS build. Use email sign-in or add the Google client ID to .env.");
    try {
      if (Platform.OS === "web") {
        const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
        await completeGoogleSignIn(credential.user);
        return;
      }
      if (!googleRequest) throw new Error("Google sign-in is not configured. Add the Google client IDs to .env and rebuild the app.");
      const result = await promptGoogleAsync();
      if (result.type === "cancel" || result.type === "dismiss" || result.type === "locked") return;
      if (result.type !== "success") throw new Error("Google sign-in was not completed.");
    } catch (error) {
      throw new Error(friendlyAccountError(error));
    }
  };

  const signIn = async ({ name, email, password, role, isNew }: { name?: string; email: string; password: string; role: UserRole; isNew: boolean }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (role === "admin" && normalizedEmail !== ADMIN_EMAIL) {
      throw new Error("Only the authorized administrator email can access the admin dashboard.");
    }
    if (isNew && !isPublicRegistrationRole(role)) {
      throw new Error("Administrator accounts are created only by the Firebase project owner.");
    }
    if (firebaseAuth && isFirebaseConfigured) {
      try {
        const credential = isNew
          ? await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
          : await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
          const existingProfile = await readFirebaseUser(credential.user);
        const nextUser = existingProfile ? (credential.user.email?.trim().toLowerCase() === ADMIN_EMAIL ? { ...existingProfile, role: "admin" as const } : existingProfile) : await createFirebaseUserProfile(credential.user, { name, role });
        if (nextUser.role === "worker") await publishWorkerDirectoryProfile(nextUser);
        setUser(nextUser);
        registerDeviceForFirebaseMessaging(nextUser.id).catch(() => undefined);
        return;
      } catch (error) {
        throw new Error(friendlyAccountError(error));
      }
    }
    const nextUser: AppUser = {
      id: `local-${role}-${email.trim().toLowerCase()}`,
      name: name?.trim() || (role === "worker" ? "Service Partner" : role === "admin" ? "Platform Admin" : "Neighbour"),
      email: normalizedEmail,
      role,
      createdAt: new Date().toISOString(),
    };
    const savedProfile = await AsyncStorage.getItem(`${PROFILE_KEY_PREFIX}${nextUser.id}`);
    const hydratedUser = savedProfile ? { ...nextUser, ...(JSON.parse(savedProfile) as Partial<AppUser>) } : nextUser;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(hydratedUser));
    setUser(hydratedUser);
  };

  const resetPassword = async (email: string) => {
    if (firebaseAuth && isFirebaseConfigured) {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      return true;
    }
    return false;
  };

  const updateProfile = async (input: { name?: string; phone?: string; address?: string; workerProfile?: Record<string, unknown> }) => {
    if (!user) throw new Error("Sign in before updating your profile.");
    const nextUser: AppUser = {
      ...user,
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.address !== undefined ? { address: input.address.trim() } : {}),
    };
    if (firebaseAuth && isFirebaseConfigured) await updateFirebaseUserProfile(user, input);
    else {
      await AsyncStorage.setItem(`${PROFILE_KEY_PREFIX}${user.id}`, JSON.stringify({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
      }));
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    }
    setUser(nextUser);
  };

  const signOut = async () => {
    if (firebaseAuth && isFirebaseConfigured) {
      if (user?.role === "worker") await setWorkerDirectoryOnline(user, false).catch(() => undefined);
      await signOutFromFirebase(firebaseAuth);
    }
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const value = useMemo(() => ({ isLoading, user, signIn, signInWithGoogle, resetPassword, updateProfile, signOut }), [isLoading, user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useGigSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useGigSession must be used within GigSessionProvider");
  return context;
}

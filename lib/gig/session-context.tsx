import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as signOutFromFirebase } from "firebase/auth";

import { firebaseAuth, isFirebaseConfigured } from "./firebase";
import { createFirebaseUserProfile, publishWorkerDirectoryProfile, readFirebaseUser, setWorkerDirectoryOnline, updateFirebaseUserProfile } from "./firebase-repository";
import { registerDeviceForFirebaseMessaging } from "./notifications";
import type { AppUser, UserRole } from "./models";
import { isPublicRegistrationRole } from "./registration";

type SessionState = {
  isLoading: boolean;
  user: AppUser | null;
  signIn: (input: { name?: string; email: string; password: string; role: UserRole; isNew: boolean }) => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (input: { name?: string; phone?: string; address?: string; workerProfile?: Record<string, unknown> }) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);
const SESSION_KEY = "cooperative-gig-services/session";

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

  useEffect(() => {
    if (firebaseAuth && isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        try {
          const profile = firebaseUser ? await readFirebaseUser(firebaseUser) : null;
          if (profile?.role === "worker") await publishWorkerDirectoryProfile(profile);
          setUser(profile);
          if (profile) registerDeviceForFirebaseMessaging(profile.id).catch(() => undefined);
        } finally {
          setIsLoading(false);
        }
      });
      return unsubscribe;
    }
    AsyncStorage.getItem(SESSION_KEY)
      .then((value) => (value ? (JSON.parse(value) as AppUser) : null))
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = async ({ name, email, password, role, isNew }: { name?: string; email: string; password: string; role: UserRole; isNew: boolean }) => {
    if (isNew && !isPublicRegistrationRole(role)) {
      throw new Error("Administrator accounts are created only by the Firebase project owner.");
    }
    if (firebaseAuth && isFirebaseConfigured) {
      try {
        const credential = isNew
          ? await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
          : await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        const existingProfile = await readFirebaseUser(credential.user);
        const nextUser = existingProfile ?? await createFirebaseUserProfile(credential.user, { name, role });
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
      email: email.trim().toLowerCase(),
      role,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
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
    else await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
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

  const value = useMemo(() => ({ isLoading, user, signIn, resetPassword, updateProfile, signOut }), [isLoading, user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useGigSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useGigSession must be used within GigSessionProvider");
  return context;
}

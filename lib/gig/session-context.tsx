import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { GoogleSignin } from "@react-native-google-signin/google-signin";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  signOut as signOutFromFirebase,
} from "firebase/auth";

import { firebaseAuth, isFirebaseConfigured } from "./firebase";

import {
  createFirebaseUserProfile,
  publishWorkerDirectoryProfile,
  readFirebaseUser,
  setWorkerDirectoryOnline,
  updateFirebaseUserProfile,
} from "./firebase-repository";

import { registerDeviceForFirebaseMessaging } from "./notifications";

import type { AppUser, UserRole } from "./models";

import { isPublicRegistrationRole } from "./registration";


// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

type SessionState = {
  isLoading: boolean;

  user: AppUser | null;

  signIn: (input: {
    name?: string;
    email: string;
    password: string;
    role: UserRole;
    isNew: boolean;
  }) => Promise<void>;

  signInWithGoogle: () => Promise<void>;

  resetPassword: (email: string) => Promise<boolean>;

  updateProfile: (input: {
    name?: string;
    phone?: string;
    address?: string;
    workerProfile?: Record<string, unknown>;
  }) => Promise<void>;

  signOut: () => Promise<void>;
};


// ---------------------------------------------------------
// CONTEXT
// ---------------------------------------------------------

const SessionContext = createContext<SessionState | null>(null);


// ---------------------------------------------------------
// LOCAL STORAGE KEYS
// ---------------------------------------------------------

const SESSION_KEY = "cooperative-gig-services/session";

const PROFILE_KEY_PREFIX =
  "cooperative-gig-services/profile/";


// ---------------------------------------------------------
// ADMIN
// ---------------------------------------------------------

const ADMIN_EMAIL = "siddhardhar471@gmail.com";


// ---------------------------------------------------------
// GOOGLE CONFIG
// ---------------------------------------------------------

const googleExtra = (Constants.expoConfig?.extra?.google ?? {}) as {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
};

const googleAndroidClientId =
  googleExtra.androidClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  "";

const googleIosClientId =
  googleExtra.iosClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "";

const googleWebClientId =
  googleExtra.webClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "";


// ---------------------------------------------------------
// ERROR HANDLER
// ---------------------------------------------------------

function friendlyAccountError(error: unknown) {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error
      ? String(error.code)
      : "";

  // Firebase errors
  if (code === "auth/email-already-in-use") {
    return "This email already has an account. Choose Sign in instead.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address, for example name@example.com.";
  }

  if (code === "auth/weak-password") {
    return "Use a password with at least 6 characters.";
  }

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "Email or password is incorrect. Check the details or use Forgot password.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many sign-in attempts. Wait a few minutes, then try again.";
  }

  if (code === "auth/operation-not-allowed") {
    return "Email/Password sign-in is not enabled in Firebase Authentication.";
  }

  if (code === "auth/api-key-not-valid") {
    return "Firebase API key is invalid. Verify the local .env configuration.";
  }

  if (code === "auth/network-request-failed") {
    return "Network connection failed. Check your internet connection.";
  }


  // Firestore errors
  if (
    code === "permission-denied" ||
    code === "firestore/permission-denied"
  ) {
    return "Your Firebase account was created, but its profile could not be saved. Check Firestore Rules.";
  }


  // Google Sign-In errors
  if (code === "DEVELOPER_ERROR") {
    return "Google Sign-In configuration error. Check Android package name, SHA-1, and google-services.json.";
  }

  if (code === "SIGN_IN_CANCELLED") {
    return "";
  }

  if (code === "IN_PROGRESS") {
    return "Google Sign-In is already in progress.";
  }

  if (code === "PLAY_SERVICES_NOT_AVAILABLE") {
    return "Google Play Services is not available or needs to be updated.";
  }


  // Generic error
  return error instanceof Error
    ? error.message
    : "Please review the details and try again.";
}


// ---------------------------------------------------------
// PROVIDER
// ---------------------------------------------------------

export function GigSessionProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [isLoading, setIsLoading] =
    useState(true);

  const [user, setUser] =
    useState<AppUser | null>(null);


  // -------------------------------------------------------
  // CONFIGURE NATIVE GOOGLE SIGN-IN
  // -------------------------------------------------------

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    if (!googleWebClientId) {
      console.warn(
        "Google Sign-In: Web Client ID is missing."
      );

      return;
    }

    try {
      GoogleSignin.configure({
        webClientId: googleWebClientId,
        offlineAccess: false,
      });

      console.log(
        "Google Sign-In configured successfully."
      );

      console.log(
        "Google Web Client ID:",
        googleWebClientId
      );

    } catch (error) {
      console.error(
        "Google Sign-In configure error:",
        error
      );
    }
  }, []);


  // -------------------------------------------------------
  // COMPLETE GOOGLE FIREBASE LOGIN
  // -------------------------------------------------------

  const completeGoogleSignIn = async (
    firebaseUser: NonNullable<
      Parameters<typeof readFirebaseUser>[0]
    >
  ) => {

    const existingProfile =
      await readFirebaseUser(firebaseUser);


    const nextUser =
      existingProfile ??
      await createFirebaseUserProfile(
        firebaseUser,
        {
          name:
            firebaseUser.displayName ??
            undefined,

          role: "customer",
        }
      );


    setUser(nextUser);


    registerDeviceForFirebaseMessaging(
      nextUser.id
    ).catch(() => undefined);
  };


  // -------------------------------------------------------
  // FIREBASE AUTH STATE
  // -------------------------------------------------------

  useEffect(() => {

    if (
      firebaseAuth &&
      isFirebaseConfigured
    ) {

      const unsubscribe =
        onAuthStateChanged(
          firebaseAuth,
          async (firebaseUser) => {

            try {

              const profile =
                firebaseUser
                  ? await readFirebaseUser(firebaseUser)
                  : null;


              const normalizedProfile =
                profile &&
                firebaseUser?.email
                  ?.trim()
                  .toLowerCase() ===
                  ADMIN_EMAIL

                  ? {
                      ...profile,
                      role: "admin" as const,
                    }

                  : profile;


              if (
                normalizedProfile?.role ===
                "worker"
              ) {

                await publishWorkerDirectoryProfile(
                  normalizedProfile
                );
              }


              setUser(
                normalizedProfile
              );


              if (normalizedProfile) {

                registerDeviceForFirebaseMessaging(
                  normalizedProfile.id
                ).catch(() => undefined);
              }

            } finally {

              setIsLoading(false);
            }
          }
        );


      return unsubscribe;
    }


    // -----------------------------------------------------
    // LOCAL SESSION FALLBACK
    // -----------------------------------------------------

    AsyncStorage
      .getItem(SESSION_KEY)

      .then(async (value) => {

        if (!value) {
          return null;
        }


        const sessionUser =
          JSON.parse(value) as AppUser;


        const savedProfile =
          await AsyncStorage.getItem(
            `${PROFILE_KEY_PREFIX}${sessionUser.id}`
          );


        return savedProfile

          ? {
              ...sessionUser,
              ...(JSON.parse(
                savedProfile
              ) as Partial<AppUser>),
            }

          : sessionUser;
      })

      .then(setUser)

      .finally(() =>
        setIsLoading(false)
      );

  }, []);


  // -------------------------------------------------------
  // GOOGLE SIGN-IN
  // -------------------------------------------------------

  const signInWithGoogle =
    async () => {

      if (
        !firebaseAuth ||
        !isFirebaseConfigured
      ) {

        throw new Error(
          "Configure Firebase before using Google sign-in."
        );
      }


      try {

        // -------------------------------------------------
        // WEB
        // -------------------------------------------------

        if (Platform.OS === "web") {

          const credential =
            await signInWithPopup(
              firebaseAuth,
              new GoogleAuthProvider()
            );


          await completeGoogleSignIn(
            credential.user
          );

          return;
        }


        // -------------------------------------------------
        // ANDROID / IOS
        // -------------------------------------------------

        if (!googleWebClientId) {

          throw new Error(
            "Google Web Client ID is missing. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env and rebuild the app."
          );
        }


        // Check Google Play Services
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });


        // Start native Google Sign-In
        const response =
          await GoogleSignin.signIn({});


        // -------------------------------------------------
        // USER CANCELLED
        // -------------------------------------------------

        if (
          response.type !== "success"
        ) {

          console.log(
            "Google Sign-In cancelled."
          );

          return;
        }


        // -------------------------------------------------
        // GET ID TOKEN
        // -------------------------------------------------

        const idToken =
          response.data.idToken;


        if (!idToken) {

          throw new Error(
            "Google Sign-In succeeded, but no ID token was returned. Check that the Web OAuth Client ID is correct."
          );
        }


        console.log(
          "Google ID token received."
        );


        // -------------------------------------------------
        // FIREBASE GOOGLE CREDENTIAL
        // -------------------------------------------------

        const googleCredential =
          GoogleAuthProvider.credential(
            idToken
          );


        // -------------------------------------------------
        // SIGN IN TO FIREBASE
        // -------------------------------------------------

        const firebaseCredential =
          await signInWithCredential(
            firebaseAuth,
            googleCredential
          );


        // -------------------------------------------------
        // CREATE / LOAD USER PROFILE
        // -------------------------------------------------

        await completeGoogleSignIn(
          firebaseCredential.user
        );

      } catch (error) {

        console.error(
          "Google Sign-In error:",
          error
        );


        const message =
          friendlyAccountError(error);


        // User cancelled - don't show error
        if (!message) {
          return;
        }


        throw new Error(message);
      }
    };


  // -------------------------------------------------------
  // EMAIL LOGIN / REGISTER
  // -------------------------------------------------------

  const signIn = async ({
    name,
    email,
    password,
    role,
    isNew,
  }: {
    name?: string;
    email: string;
    password: string;
    role: UserRole;
    isNew: boolean;
  }) => {

    const normalizedEmail =
      email.trim().toLowerCase();


    // -----------------------------------------------------
    // ADMIN CHECK
    // -----------------------------------------------------

    if (
      role === "admin" &&
      normalizedEmail !== ADMIN_EMAIL
    ) {

      throw new Error(
        "Only the authorized administrator email can access the admin dashboard."
      );
    }


    // -----------------------------------------------------
    // REGISTRATION ROLE CHECK
    // -----------------------------------------------------

    if (
      isNew &&
      !isPublicRegistrationRole(role)
    ) {

      throw new Error(
        "Administrator accounts are created only by the Firebase project owner."
      );
    }


    // -----------------------------------------------------
    // FIREBASE LOGIN
    // -----------------------------------------------------

    if (
      firebaseAuth &&
      isFirebaseConfigured
    ) {

      try {

        const credential =
          isNew

            ? await createUserWithEmailAndPassword(
                firebaseAuth,
                email.trim(),
                password
              )

            : await signInWithEmailAndPassword(
                firebaseAuth,
                email.trim(),
                password
              );


        const existingProfile =
          await readFirebaseUser(
            credential.user
          );


        const nextUser =
          existingProfile

            ? (
                credential.user.email
                  ?.trim()
                  .toLowerCase() ===
                ADMIN_EMAIL

                  ? {
                      ...existingProfile,
                      role: "admin" as const,
                    }

                  : existingProfile
              )

            : await createFirebaseUserProfile(
                credential.user,
                {
                  name,
                  role,
                }
              );


        if (
          nextUser.role === "worker"
        ) {

          await publishWorkerDirectoryProfile(
            nextUser
          );
        }


        setUser(nextUser);


        registerDeviceForFirebaseMessaging(
          nextUser.id
        ).catch(() => undefined);


        return;

      } catch (error) {

        throw new Error(
          friendlyAccountError(error)
        );
      }
    }


    // -----------------------------------------------------
    // LOCAL FALLBACK
    // -----------------------------------------------------

    const nextUser: AppUser = {

      id:
        `local-${role}-${normalizedEmail}`,

      name:
        name?.trim() ||
        (
          role === "worker"
            ? "Service Partner"

            : role === "admin"
              ? "Platform Admin"

              : "Neighbour"
        ),

      email:
        normalizedEmail,

      role,

      createdAt:
        new Date().toISOString(),
    };


    const savedProfile =
      await AsyncStorage.getItem(
        `${PROFILE_KEY_PREFIX}${nextUser.id}`
      );


    const hydratedUser =
      savedProfile

        ? {
            ...nextUser,
            ...(JSON.parse(
              savedProfile
            ) as Partial<AppUser>),
          }

        : nextUser;


    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify(
        hydratedUser
      )
    );


    setUser(
      hydratedUser
    );
  };


  // -------------------------------------------------------
  // RESET PASSWORD
  // -------------------------------------------------------

  const resetPassword =
    async (email: string) => {

      if (
        firebaseAuth &&
        isFirebaseConfigured
      ) {

        await sendPasswordResetEmail(
          firebaseAuth,
          email.trim()
        );

        return true;
      }


      return false;
    };


  // -------------------------------------------------------
  // UPDATE PROFILE
  // -------------------------------------------------------

  const updateProfile =
    async (input: {
      name?: string;
      phone?: string;
      address?: string;
      workerProfile?: Record<string, unknown>;
    }) => {

      if (!user) {

        throw new Error(
          "Sign in before updating your profile."
        );
      }


      const nextUser: AppUser = {

        ...user,

        ...(input.name
          ? {
              name:
                input.name.trim(),
            }
          : {}),

        ...(input.phone !== undefined
          ? {
              phone:
                input.phone.trim(),
            }
          : {}),

        ...(input.address !== undefined
          ? {
              address:
                input.address.trim(),
            }
          : {}),
      };


      if (
        firebaseAuth &&
        isFirebaseConfigured
      ) {

        await updateFirebaseUserProfile(
          user,
          input
        );

      } else {

        await AsyncStorage.setItem(
          `${PROFILE_KEY_PREFIX}${user.id}`,

          JSON.stringify({

            ...(input.name !== undefined
              ? {
                  name:
                    input.name.trim(),
                }
              : {}),

            ...(input.phone !== undefined
              ? {
                  phone:
                    input.phone.trim(),
                }
              : {}),

            ...(input.address !== undefined
              ? {
                  address:
                    input.address.trim(),
                }
              : {}),
          })
        );


        await AsyncStorage.setItem(
          SESSION_KEY,
          JSON.stringify(
            nextUser
          )
        );
      }


      setUser(nextUser);
    };


  // -------------------------------------------------------
  // SIGN OUT
  // -------------------------------------------------------

  const signOut =
    async () => {

      if (
        firebaseAuth &&
        isFirebaseConfigured
      ) {

        if (
          user?.role === "worker"
        ) {

          await setWorkerDirectoryOnline(
            user,
            false
          ).catch(
            () => undefined
          );
        }


        await signOutFromFirebase(
          firebaseAuth
        );
      }


      // Native Google sign out
      if (
        Platform.OS !== "web"
      ) {

        try {

          await GoogleSignin.signOut();

        } catch (error) {

          console.warn(
            "Google Sign-Out warning:",
            error
          );
        }
      }


      await AsyncStorage.removeItem(
        SESSION_KEY
      );


      setUser(null);
    };


  // -------------------------------------------------------
  // CONTEXT VALUE
  // -------------------------------------------------------

  const value =
    useMemo(
      () => ({
        isLoading,
        user,
        signIn,
        signInWithGoogle,
        resetPassword,
        updateProfile,
        signOut,
      }),

      [
        isLoading,
        user,
      ]
    );


  return (
    <SessionContext.Provider
      value={value}
    >
      {children}
    </SessionContext.Provider>
  );
}


// ---------------------------------------------------------
// HOOK
// ---------------------------------------------------------

export function useGigSession() {

  const context =
    useContext(
      SessionContext
    );


  if (!context) {

    throw new Error(
      "useGigSession must be used within GigSessionProvider"
    );
  }


  return context;
}
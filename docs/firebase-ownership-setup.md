# User-Owned Firebase and Database Setup

## Ownership Model

This project is designed so that **all production application data remains under your control**. Create the Firebase project from your own Google account or organisation account. You will own the Firebase project, Google Cloud billing account, Firestore database, Storage bucket, authentication users, FCM configuration, audit settings, and application registrations. The mobile client connects only to the Firebase configuration that you provide.

> The generated project does **not** depend on a platform-owned database for Cooperative Gig Services records. The template’s optional local server/database files are not used by the Firebase data model described here.

| Approach | Ownership and trade-offs | Cost | Setup complexity |
|---|---|---:|---:|
| **Your Firebase project** | You control the Google account, Firebase Console, Firestore, Auth, Storage, FCM, access roles, exports, and billing. This matches the requested technology stack and is the recommended integration for this project. | Firebase free tier is available; usage-based charges can apply as usage grows. | Moderate |
| **Your self-hosted PostgreSQL/API** | You retain maximum infrastructure control, but must operate servers, authentication, media storage, push delivery, backups, and security updates yourself. | Hosting and operations costs apply. | High |

The rest of this folder follows the **user-owned Firebase** option specified in the original project requirements. Firebase’s JavaScript SDK supports Authentication, Firestore, and Storage in Expo/React Native projects. [1]

## Create Your Firebase Project

Create a new Firebase project from [Firebase Console](https://console.firebase.google.com/) while signed in to the Google account you want to retain as owner. In **Project settings**, keep at least two owners in the Google Cloud IAM configuration so that operational access is not tied to a single individual.

Enable the following services in the same Firebase project.

| Service | Required configuration | Used for |
|---|---|---|
| Firebase Authentication | Enable **Email/Password** sign-in. | Customer, worker, and admin accounts. |
| Cloud Firestore | Create the production database in your preferred region. | Users, workers, services, bookings, chats, messages, reviews, notifications, and complaints. |
| Cloud Storage | Create the default bucket and deploy `firebase/storage.rules`. | Worker profile images and booking photos. |
| Firebase Cloud Messaging | Configure Android/iOS applications and FCM credentials. | Booking, chat, job, and cancellation notifications. |
| Google Maps Platform | Enable Maps SDK/API services in your own Google Cloud project and restrict the key. | Service-location maps and nearby-worker experiences. |

Register a **Web app** in the Firebase project and enter the configuration object values through the project’s secure environment-variable screen. Expo’s documented Firebase JS SDK workflow uses a Firebase web-app configuration object for this use case. [1]

For Android and iOS production builds, also register the native apps with the bundle identifiers from `app.config.ts`. Download the generated native Firebase configuration files only into your private build environment; do not commit credentials or service-account keys to this repository.

## Connect This Folder

Enter values from **Firebase Console → Project settings → Your apps → Web app** through the project’s secure environment-variable screen. Do not commit a populated `.env` file.

| Environment variable | Firebase console source |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Web app config: `apiKey` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web app config: `authDomain` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Web app config: `projectId` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Web app config: `storageBucket` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web app config: `messagingSenderId` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Web app config: `appId` |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs & Services → Credentials |

The Firebase API key in the mobile configuration identifies the Firebase project; it is not a substitute for access control. Sensitive application data must be protected with Firebase Authentication and Firestore/Storage Security Rules. Every mobile/web Firestore request is evaluated against deployed security rules. [2]

## Firestore Collections

| Collection | Document ID | Primary owner/access pattern |
|---|---|---|
| `users` | Firebase Auth UID | The account owner and administrators. |
| `workers` | Worker profile ID | Public signed-in discovery; the owning worker and administrators may modify. |
| `services` | Service ID | Signed-in read; administrator-managed catalog. |
| `bookings` | Booking ID | The assigned customer, worker, or administrator. |
| `chats` | Booking ID | Booking participants only. |
| `chats/{bookingId}/messages` | Message ID | Booking participants only. |
| `reviews` | Booking ID | Created once by the booking customer after completion. |
| `notifications` | Notification ID | The recipient may read/update their own notification state. |
| `complaints` | Complaint ID | Reporter and administrators. |

Use the booking ID as the review document ID. This enables the security rules to prevent multiple reviews for the same booking without a database query.

## Deploy Security Rules and Indexes

Install the Firebase CLI on your own machine, sign in to your own Google account, then initialise the directory with the Firebase project you created. Deploy the project-owned files in this folder.

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Cloud Firestore Security Rules version 2 is used in `firebase/firestore.rules`. Firebase documents that rules provide access control and validation, and that requests from mobile/web SDKs are checked against those rules before reads or writes are allowed. [2]

## Operational Control, Backups, and Release Safety

Keep Firebase billing, Google Cloud IAM, Maps API restrictions, and Firebase service configuration in accounts you own. Restrict Maps keys to the actual Android/iOS bundle identifiers and only the required APIs. Grant developers least-privilege IAM roles; do not share the project owner password.

Before release, test the rules using the Firebase Emulator Suite or Firebase Rules simulator, test unauthorized requests, and set a recurring export/backup policy appropriate to your organisation’s recovery needs. Firebase Security Rules do not secure requests made with server-admin credentials, so any Cloud Functions or trusted notification service must run in your own Google Cloud/Firebase project with properly limited IAM permissions. [2]

## References

[1] [Using Firebase — Expo Documentation](https://docs.expo.dev/guides/using-firebase/)

[2] [Get started with Cloud Firestore Security Rules — Firebase](https://firebase.google.com/docs/firestore/security/get-started)

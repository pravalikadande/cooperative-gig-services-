# Cooperative Gig Services — Complete Project Handoff

## What You Own

The **Cooperative Gig Services** source folder and its production data are separated cleanly. You own the full project folder, the Firebase project `cooperative-gig-services`, Firebase Authentication users, Cloud Firestore database, Firebase Storage bucket once enabled, Firebase Cloud Messaging credentials, Google Maps key, Google Cloud billing, and all account permissions. No production booking, chat, profile, review, or notification data is intended to be stored in a platform-owned database.

| Asset | Ownership location | Status |
|---|---|---|
| Mobile application source | This project folder | Complete and downloadable |
| Email/password accounts | Your Firebase Authentication project | Enabled |
| Customer, worker, booking, chat, review, and complaint data | Your Cloud Firestore project | Created and secured with published Firestore Rules |
| Profile and booking photos | Your Firebase Storage bucket | Source support included; enable Storage when you choose a Firebase billing plan if the console requires it |
| Push messages | Your Firebase Cloud Messaging project and included Functions source | Client registration and Functions source included; deploy Functions from your project |
| Maps and location | Your Google Cloud Maps key | Native map/location code included; add a restricted Maps key before release |

## Folder Map

| Path | Purpose |
|---|---|
| `app/` | Expo Router layouts and the mobile app shell. |
| `components/gig/` | Customer marketplace, worker/admin operations, and service-location maps. |
| `lib/gig/` | Domain models, booking lifecycle guards, Firebase initialization, repository operations, notification registration, and location access. |
| `firebase/firestore.rules` | Published Firestore access-control rules for customer, worker, administrator, chat, review, complaint, and device-token data. |
| `firebase/storage.rules` | Storage rules for worker profile images and booking photos. |
| `firebase/firestore.indexes.json` | Required booking and worker query indexes. |
| `firebase/functions/` | Firebase Cloud Functions source that sends booking and chat FCM notifications. |
| `docs/firebase-ownership-setup.md` | Detailed Firebase ownership, security, connection, and operations guidance. |
| `tests/` | Booking lifecycle and Firebase configuration validation tests. |

## Run the Mobile Project

Install dependencies and start the development server from the project root.

```bash
pnpm install
pnpm dev
```

For native testing, open the generated Expo QR code on a physical Android/iOS device. Email/password authentication is already wired to your Firebase configuration. A customer or worker can register through the app; their profile is created in `users/{uid}` in Cloud Firestore.

## Firebase Deployment From Your Account

Install Firebase CLI under your own account, sign in, and select the Firebase project you created. The project root already contains `firebase.json` pointing to the included rules and index definitions.

```bash
npm install -g firebase-tools
firebase login
cd cooperative-gig-services-v2
firebase use cooperative-gig-services
firebase deploy --only firestore:rules,firestore:indexes
```

When Cloud Storage is enabled in Firebase Console, deploy the storage rule file as well.

```bash
firebase deploy --only storage
```

To deploy the FCM notification functions, install and validate the isolated Functions workspace before deploying.

```bash
cd firebase/functions
npm install
npm run build
cd ../..
firebase deploy --only functions
```

## Admin Access

The initial app registration flow intentionally permits only the `customer` and `worker` roles. To grant a trusted platform administrator role, first create their email/password account in the app. Then open **Firestore Database → users → their Firebase UID** in your Firebase Console and change their `role` field to `admin`. Firebase Console changes made by a project owner use Google Cloud IAM and can administer the record even though ordinary mobile clients are restricted by Firestore Rules.

Never grant Firebase project ownership to ordinary administrators. Add only the minimum Google Cloud/Firebase IAM roles needed for operations, and retain at least two trusted project owners in your organisation.

## Required Before Production Release

| Item | Required action |
|---|---|
| Storage | If Firebase requires a billing plan to enable Storage, enable it only in your own Firebase project. Then deploy `firebase/storage.rules`. Until then, the app still supports its core booking flow but cannot persist picked images. |
| Google Maps | Create a Google Maps API key in your Google Cloud account, restrict it to this app’s Android/iOS identifiers, enable the relevant Maps SDKs, and enter the key in the project’s secure environment settings as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Rebuild the native app after adding it. |
| FCM credentials | Configure Firebase Cloud Messaging credentials for Android/iOS in your Firebase project and deploy `firebase/functions`. Use a development/release native build on a physical device to verify remote push. |
| Security validation | Use Firebase Rules simulator or Emulator Suite to test customers, workers, and admins against unauthorised document paths before release. |
| Release build | Create a fresh checkpoint, then use the project UI’s **Publish** action to produce an Android build. Do not build an APK manually in the sandbox. |

## Current Validation

The project passed TypeScript validation, booking-lifecycle tests, Firebase configuration validation against the user-owned Firestore project, and Firebase Functions TypeScript validation. Native maps, photo library access, device push tokens, Firebase Storage uploads, and phone dialing require testing on a physical Android/iOS build because they depend on device permissions and Firebase/Google Cloud configuration.

## Security Notes

Firestore Rules use deny-by-default access and explicitly limit collection operations by identity and role. Chat messages are restricted to booking participants, review documents use the booking ID so a completed booking can receive only one review, and Storage rules reject non-image uploads or files above 5 MB. Treat Firebase service-account JSON files as highly sensitive; never add them to this project folder, source control, or chat.

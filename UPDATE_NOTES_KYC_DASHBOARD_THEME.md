# Cooperative Gig Services — Complete Update

## Expo Go startup fixes

The project now uses `expo-auth-session` version `~7.0.11`, compatible with Expo SDK 54. This replaces the incompatible `expo-auth-session@57` dependency that caused the `Cannot find native module 'ExpoCryptoAES'` crash in the attached Expo Go log.

The web color hook no longer reads `ThemeProvider` context during Expo Router route discovery. Expo Router can evaluate route modules before the provider tree mounts; that ordering previously caused `useThemeContext must be used within ThemeProvider`. The web hook now subscribes to the same global theme state safely and still responds to Light/Dark changes.

## KYC submission and approval

The worker KYC flow accepts the MIME type supplied by Expo ImagePicker and infers the file type from the selected URI when Android returns an empty Blob MIME type. Valid image formats include JPG, PNG, HEIC, GIF, and WebP; PDF is also accepted by the upload helper. Local file-read failures and missing Firebase Storage configuration now show actionable messages.

The submission flow validates the worker ID, selected identity document, selected selfie, and at least four alphanumeric ID characters before uploading. The two documents are uploaded to Firebase Storage, then a `workerKyc/{workerId}` record is written with `pending` status.

Admin approval updates both `workerKyc/{workerId}` and `workers/{workerId}.isVerified` in one Firestore batch. This makes approval effective for worker gating, the public worker directory, the Verified filter, and admin status. The admin review screen has buttons to open the uploaded ID and selfie before approving or requesting resubmission.

To submit KYC, sign in as a worker, open **Profile → KYC verification**, choose the document type, enter the full ID number, select an ID document and a selfie, then press **Submit for verification**. To review it, sign in with a provisioned administrator account, open **KYC**, inspect the two documents, and choose **Approve KYC** or **Request resubmission**.

## Admin dashboard

The overview includes a live booking-status bar chart and a worker-performance scatter plot. Both charts use current Firestore subscriptions and show an empty state until live records exist; no demo numbers are used.

## Appearance

Customer, worker, and admin settings include an **Appearance** section at the end of the profile/settings options. Light and Dark choices are persisted with AsyncStorage. Customer, worker, and admin page shells use the selected palette for their backgrounds and headers.

## Local run

From the folder that contains `package.json`, run:

```powershell
pnpm install
pnpm exec expo start --tunnel --clear
```

Scan the terminal QR code with Expo Go. The distributed project includes the Firebase client runtime configuration needed by the app; do not commit or share environment files outside the project team.

## Validation

- `pnpm check` passed.
- `pnpm test` passed: 14 tests passed and 1 existing logout test was skipped.
- `pnpm build` passed.
- `pnpm lint` completed with 0 errors; only pre-existing warnings remain.

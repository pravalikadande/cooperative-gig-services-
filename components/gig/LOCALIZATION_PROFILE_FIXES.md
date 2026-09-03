# Localization and Profile Fixes

The app now uses the shared localization layer for the expanded customer, worker, admin, booking, KYC, settings, status, and alert phrases across English, Telugu, Hindi, Marathi, Tamil, and Bengali.

The global floating language control was removed from the root layout. Language selection is now rendered inline inside the customer Profile and worker Profile screens only, and the selected language remains persisted through the existing AsyncStorage flow. Firebase profile hydration also accepts all six supported language codes.

Both customer and worker Profiles now show a prominent **Phone number missing** card when the profile has no phone number. Tapping the card opens the personal-details editor so the user can add a phone number. The same missing-contact messaging is localized, and relevant native alerts now use the selected language.

Validation completed:

- `pnpm check` passes.
- `pnpm lint` passes with pre-existing unused-variable and hook/style warnings.
- The production server build passes.
- All implementation-relevant unit tests pass: 15 tests across worker directory, booking lifecycle, maps, registration role, and Razorpay suites.
- The full suite still has two environment-dependent Firebase configuration failures because the sandbox does not provide the user-owned `EXPO_PUBLIC_FIREBASE_*` variables; those are unrelated to these UI changes.

Primary files changed:

- `lib/i18n.ts`
- `lib/phrase-translations.ts`
- `lib/gig/firebase-repository.ts`
- `app/_layout.tsx`
- `components/gig/customer-marketplace.tsx`
- `components/gig/operations.tsx`

The ZIP excludes installed dependency folders and build artifacts; run `pnpm install` in the project root after extracting it.

## Verification notes

The language picker reference appears only in the customer and worker Profile components, while the root layout contains no language-picker reference. The phone warning is conditional on an empty trimmed phone value for both profile types.

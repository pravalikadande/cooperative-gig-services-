# Changes Implemented

## KYC and ID privacy

The worker KYC form now accepts the complete identity-document number in the UI. Before persistence, formatting characters are removed and only the final four alphanumeric characters are passed to Firebase. The repository write path independently normalizes and validates the suffix, strips the raw field from the payload, and persists only `idNumberLast4`. The raw value is cleared from the form state after a successful submission.

## Skip for now behavior

Selecting **Skip for now** from the mandatory KYC screen opens the worker profile page. The worker dashboard, requests, jobs, earnings, availability, public-profile editing, and other worker tools remain disabled in this skipped state. KYC verification remains available so the worker can complete verification and unlock the app.

## Android back button

Hardware back handling now unwinds nested screens before leaving the app. It covers authentication, worker dashboard tabs and chat, worker profile subviews, mandatory KYC, customer marketplace flows, customer profile subviews, admin tabs, and the open language menu.

## Multilingual behavior

The localization layer now covers the expanded UI vocabulary, localized text inputs, composed text children, common interpolated sentences, worker counts, prices, status lines, KYC review details, and the new full-ID input. The global language picker also closes correctly with Android back.

## Verification

TypeScript completed without errors. The environment-backed Vitest suite completed with 14 passing tests and 1 intentionally skipped test. Expo lint completed with 0 errors and 10 pre-existing warnings.

## Main files changed

- `app/(tabs)/index.tsx`
- `components/gig/customer-marketplace.tsx`
- `components/gig/operations.tsx`
- `lib/gig/firebase-repository.ts`
- `lib/i18n.tsx`
- `CHANGES_IMPLEMENTED.md`

## Latest KYC and admin fixes

The KYC screen now shows a real thumbnail preview after each document or selfie is selected, a green selected state, and a success banner after both uploads and the Firestore submission complete. The submit button shows an upload/submission progress state and is disabled after approval. The worker dashboard remains intentionally gated while KYC is pending and opens automatically when the admin review changes the worker KYC status to approved.

The admin sign-in screen no longer shows the create-account switch. The admin All Workers view now includes a visible Overview back button, and the Android hardware back handler also returns from that module to the admin overview.

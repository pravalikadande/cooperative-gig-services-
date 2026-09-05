# Localization Fix

The app now routes visible text and alert dialogs through the selected-language localization layer. The shared translator supports direct phrases, embedded phrases in interpolated strings, localized text inputs, OAuth callback status messages, and multi-button alerts.

The customer, worker, admin, authentication, OAuth callback, map fallback, appearance setting, and shared collapsible UI paths were updated so they no longer bypass localization with native `Text` or raw `Alert.alert` calls. The customer home service cards, greetings, search label, worker status, price labels, and bottom navigation are now translated. The admin dashboard header now includes a working global language button, and its portal heading and navigation labels follow the selected language. The phrase catalog was expanded for the remaining customer-facing UI copy in Telugu, Hindi, Marathi, Tamil, and Bengali.

Verification completed:

- `pnpm check` passed with no TypeScript errors.
- `pnpm test` passed: 18 tests passed and 1 existing test was skipped.
- `pnpm lint` passed with 0 errors; the remaining warnings are pre-existing unused-value, hook-dependency, style, and require-import warnings.
- Source audit found no remaining raw `Alert.alert` calls in `app` or `components`.

The `.env`, dependencies, and local Expo state are excluded from the delivery archive.

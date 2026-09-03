# Cooperative Gig Localization — Mobile Interface Plan

## Product intent

Cooperative Gig connects customers and workers through a simple, localized mobile experience. The interface is designed for portrait orientation and one-handed use, with consistent copy in the selected language and clear profile-completion prompts.

## Screen list and functionality

| Screen | Primary content and functionality |
|---|---|
| Home / Dashboard | Greeting, role-aware shortcuts, current activity, and concise localized status messages. |
| Customer Marketplace | Search and browse worker/service cards, localized categories, and detail navigation. |
| Worker Directory | Browse requests or listings with localized filters and actions. |
| Booking / Request Detail | Details, contact context, status, and primary booking/request actions. |
| Profile | Identity, role, phone number, completion state, and the only language selector. |
| Edit Profile | Name, phone number, role-specific details, save feedback, and validation. |
| Appearance Settings | Light/dark controls and localized setting descriptions. |
| Authentication / Callback | Sign-in and OAuth callback states through the shared localization layer. |

## Key user flows

### Change language

The user opens **Profile**, taps the dedicated **Language** card, selects a supported language in a compact sheet, and sees the app copy refresh immediately. The preference is persisted locally. Language controls are not repeated on other screens.

### Complete a missing phone number

A customer or worker without a phone number sees a prominent, non-blocking **Add phone number** alert on **Profile**. The alert opens **Edit Profile**, where the user enters and saves a valid number. After the profile state refreshes, the alert disappears and localized success feedback is shown.

### Browse and request work

The user opens the marketplace or directory, searches or selects a localized category, opens a detail card, reviews the information, and taps the localized primary action. Confirmation and validation states use the selected language consistently.

## Interaction and layout rules

Use large touch targets, high-contrast text, bottom-reachable primary actions, clear cards, native alerts/sheets, and safe-area-aware portrait layouts. Phone completion is communicated inline on Profile rather than through repeated interruptions.

## Color choices

| Token | Color | Use |
|---|---|---|
| Primary teal | `#0A7EA4` | Main actions and selected states |
| Ink | `#11181C` | Primary light-mode text |
| Canvas | `#FFFFFF` | Light-mode background |
| Surface | `#F5F5F5` | Cards and grouped settings |
| Border | `#E5E7EB` | Dividers and outlines |
| Warning amber | `#F59E0B` | Missing-phone alert accent |
| Error red | `#EF4444` | Validation and failure |
| Success green | `#22C55E` | Saved/completed profile state |

Dark mode uses `#151718` canvas, `#1E2022` surfaces, and `#ECEDEE` primary text while retaining semantic accent colors.

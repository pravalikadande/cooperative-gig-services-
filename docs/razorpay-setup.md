# Razorpay payment setup

The app now includes a server-side payment path for accepted bookings. The mobile app must never receive the Razorpay secret. It requests an order from Firebase Functions with a Firebase ID token, opens Razorpay Checkout using the public key returned by the function, and waits for the signed webhook to update Firestore.

## Functions

| Function | Purpose |
|---|---|
| `createRazorpayOrderHttp` | Authenticates the customer, reads the booking price from Firestore, creates an INR Razorpay order, and records a pending payment. |
| `razorpayWebhook` | Validates `x-razorpay-signature`, settles captured payments, creates one paid invoice, and marks failed payments. |

The implementation is in `firebase/functions/src/razorpay.ts`. It uses `payment.captured`, `order.paid`, and `payment.failed` events. Successful settlement is idempotent: a repeated success webhook does not create another invoice.

## Configure secrets

Set these values in the **user-owned** Firebase project. Do not commit them, place them in the Expo app, or upload a service-account JSON file.

```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

The current function reads environment variables. If your Firebase CLI version uses Secret Manager bindings, bind the same names in the function options before deployment.

## Deploy and register the webhook

```bash
cd firebase/functions
npm install
npm run build
cd ../..
firebase deploy --only functions
```

In Razorpay Dashboard, create a webhook pointing to the deployed `razorpayWebhook` HTTPS URL and use the same value as `RAZORPAY_WEBHOOK_SECRET`. Subscribe to `payment.captured`, `order.paid`, and `payment.failed`.

## Test before live release

Use Razorpay Test Mode first. Pay an accepted booking using a test UPI method, then verify the following Firestore records: `payments/{paymentId}` becomes `paid`, `bookings/{bookingId}.paymentStatus` becomes `paid`, and exactly one document is created in `invoices`. Also replay the webhook and confirm that no duplicate invoice is created. Test an invalid signature and an amount mismatch; both must be rejected.

Only after these checks pass should the project owner switch the Razorpay keys and dashboard configuration to Live Mode. The app does not automatically enable live payments, change billing, register a production webhook, or release funds.

## References

[1]: https://razorpay.com/docs/webhooks/ "Razorpay Webhooks"
[2]: https://razorpay.com/docs/webhooks/best-practices/ "Razorpay Webhook Best Practices"
[3]: https://razorpay.com/docs/payments/payment-methods/upi/ "Razorpay UPI Payments"

Razorpay documents webhook signature validation and UPI-capable checkout in the references above. [1] [2] [3]

## Current status

The server-side order and settlement code is implemented and ready for code review. **User-owned Razorpay credentials, dashboard webhook registration, Test Mode verification, and Live Mode release remain manual steps.**

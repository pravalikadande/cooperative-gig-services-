# Cooperative Gig Services Payment Backend

This standalone Express service creates Razorpay orders and verifies completed payments without deploying Firebase Cloud Functions. It still uses Firebase Admin SDK to verify Firebase ID tokens and update the existing Firestore `bookings`, `payments`, and `invoices` collections.

## Required environment variables

```env
PORT=8080
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxx
```

Never put `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or the Firebase service-account JSON in the mobile app or source control.

## Local run

```bash
npm install
npm run build
npm start
```

Health check:

```text
GET http://localhost:8080/health
```

The mobile app should use:

```env
EXPO_PUBLIC_CREATE_PAYMENT_ORDER_URL=https://YOUR-BACKEND-DOMAIN/createRazorpayOrderHttp
```

## Endpoints

`POST /createRazorpayOrderHttp` requires `Authorization: Bearer <Firebase ID token>` and JSON `{ "bookingId": "..." }`.

`POST /verifyRazorpayPayment` requires the Firebase bearer token and the Razorpay order ID, payment ID, signature, and booking ID. The backend verifies the signature before marking the payment and invoice as paid.

`POST /razorpayWebhook` verifies `x-razorpay-signature`. Configure this URL in the Razorpay dashboard after deployment.

## Deploy

Deploy this `payment-backend` directory to a Node hosting provider such as Render, Railway, or another HTTPS service. Set all environment variables in that provider’s secret environment settings. Do not commit `.env` or service-account credentials.


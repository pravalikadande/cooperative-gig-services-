"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const razorpay_1 = require("./razorpay");
(0, vitest_1.describe)("Razorpay helpers", () => {
    (0, vitest_1.it)("creates a verifiable HMAC-SHA256 webhook signature", () => {
        const payload = Buffer.from('{"event":"payment.captured"}');
        const signature = (0, razorpay_1.webhookSignature)(payload, "test-secret");
        (0, vitest_1.expect)(signature).toBe("f962b4cdc1d54bae85fda03948777b50bcfaa8f2c73369cf66577802120415ee");
    });
    (0, vitest_1.it)("converts rupees to Razorpay paise", () => {
        (0, vitest_1.expect)((0, razorpay_1.toMinorUnits)(299)).toBe(29900);
    });
    (0, vitest_1.it)("records the cooperative fee and worker payout", () => {
        (0, vitest_1.expect)((0, razorpay_1.cooperativeFee)(1000)).toBe(50);
        (0, vitest_1.expect)((0, razorpay_1.workerPayout)(1000)).toBe(950);
    });
    (0, vitest_1.it)("maps only supported settlement events", () => {
        (0, vitest_1.expect)((0, razorpay_1.paymentEventStatus)("payment.captured")).toBe("paid");
        (0, vitest_1.expect)((0, razorpay_1.paymentEventStatus)("order.paid")).toBe("paid");
        (0, vitest_1.expect)((0, razorpay_1.paymentEventStatus)("payment.failed")).toBe("failed");
        (0, vitest_1.expect)((0, razorpay_1.paymentEventStatus)("payment.authorized")).toBeNull();
    });
});

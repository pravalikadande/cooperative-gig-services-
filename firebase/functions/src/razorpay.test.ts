import { describe, expect, it } from "vitest";

import { cooperativeFee, paymentEventStatus, toMinorUnits, webhookSignature, workerPayout } from "./razorpay";

describe("Razorpay helpers", () => {
  it("creates a verifiable HMAC-SHA256 webhook signature", () => {
    const payload = Buffer.from('{"event":"payment.captured"}');
    const signature = webhookSignature(payload, "test-secret");
    expect(signature).toBe("f962b4cdc1d54bae85fda03948777b50bcfaa8f2c73369cf66577802120415ee");
  });

  it("converts rupees to Razorpay paise", () => {
    expect(toMinorUnits(299)).toBe(29900);
  });

  it("records the cooperative fee and worker payout", () => {
    expect(cooperativeFee(1000)).toBe(50);
    expect(workerPayout(1000)).toBe(950);
  });

  it("maps only supported settlement events", () => {
    expect(paymentEventStatus("payment.captured")).toBe("paid");
    expect(paymentEventStatus("order.paid")).toBe("paid");
    expect(paymentEventStatus("payment.failed")).toBe("failed");
    expect(paymentEventStatus("payment.authorized")).toBeNull();
  });
});

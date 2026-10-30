export type CheckoutFailure =
  | { kind: "declined"; message: string; retryable: boolean }
  | { kind: "terminal"; message: string };

export function checkoutFailure(statusCode?: number, body?: { error?: string; message?: string; stage?: string }): CheckoutFailure {
  const uncertain = "We couldn't confirm your payment. Your card may have been charged; contact the merchant before trying again.";
  if (statusCode === undefined || body?.error === "payment_link_capture_uncertain" || (statusCode >= 500 && body?.stage !== "authorize")) return { kind: "terminal", message: uncertain };
  if (statusCode === 402) return { kind: "declined", message: body?.stage === "capture" ? "Your payment could not be completed." : "Your card was declined.", retryable: true };
  if (statusCode === 502) return { kind: "declined", message: "The acquirer is temporarily unavailable. Please try again.", retryable: true };
  if (statusCode === 409 && body?.error === "payment_link_already_paid") return { kind: "terminal", message: "This invoice has already been paid." };
  if (statusCode === 409 && body?.error === "payment_link_reservation_lost") return { kind: "terminal", message: "This link was paid by another payment at the same time. Your card was charged; please contact the merchant for a refund." };
  if (statusCode === 409 && body?.error === "payment_link_canceled") return { kind: "terminal", message: "This payment link is no longer available." };
  if (statusCode === 409) return { kind: "declined", message: "A payment is already being processed for this link. Please try again shortly.", retryable: true };
  if (statusCode === 410) return { kind: "terminal", message: "This payment link has expired." };
  return { kind: "declined", message: body?.message ?? "Something went wrong. Please try again.", retryable: true };
}

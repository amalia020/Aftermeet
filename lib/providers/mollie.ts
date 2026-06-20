/**
 * Mollie payment-link provider for the willingness-to-pay (WTP) signal. We do
 * not create live charges in the MVP — we surface a single configured payment
 * link the user can share, and record the outcome when they confirm payment.
 */

import "server-only";
import { runtimeConfig } from "@/lib/config";

export interface PaymentLinkResult {
  available: boolean;
  url: string | null;
  /** True when this is the demo placeholder rather than a configured link. */
  demo: boolean;
}

export function getPaymentLink(): PaymentLinkResult {
  const url = runtimeConfig.keys.molliePaymentLink;
  if (url) {
    return { available: true, url, demo: false };
  }
  return {
    available: false,
    url: "https://demo.aftermeet.app/pay/wtp-9eur",
    demo: true,
  };
}

import { x402Config } from "~~/services/x402/config";
import { CheckoutForm } from "./CheckoutForm";

/** Checkout for the merchant configured in the payments module (X402_PAY_TO). */
export const DexPaymentsView = () => {
  const config = x402Config();
  if (!config) return null;
  return <CheckoutForm merchant={config.payTo} />;
};

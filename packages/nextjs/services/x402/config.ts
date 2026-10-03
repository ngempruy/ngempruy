export const X402_NETWORK = "hedera:testnet";
/** HBAR in x402 Hedera payment requirements. */
export const HBAR_ASSET = "0.0.0";

/** Payment settings from env; null while the module is not configured. */
export function x402Config() {
  const payTo = process.env.X402_PAY_TO?.trim();
  if (!payTo) return null;
  return {
    payTo,
    facilitatorUrl: process.env.X402_FACILITATOR_URL?.trim() || "https://api.testnet.blocky402.com",
    priceTinybars: process.env.X402_PRICE_TINYBARS?.trim() || "1000000",
  };
}

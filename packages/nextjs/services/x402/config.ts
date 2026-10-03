export const X402_NETWORK = "hedera:testnet";
/** HBAR in x402 Hedera payment requirements. */
export const HBAR_ASSET = "0.0.0";

/** Payment settings from env; null while the module is not configured. Throws on malformed values. */
export function x402Config() {
  const payTo = process.env.X402_PAY_TO?.trim();
  if (!payTo) return null;
  if (!/^0\.0\.\d+$/.test(payTo))
    throw new Error(`X402_PAY_TO must be a Hedera account id like 0.0.1234, got "${payTo}"`);
  const priceTinybars = process.env.X402_PRICE_TINYBARS?.trim() || "1000000";
  if (!/^[1-9]\d*$/.test(priceTinybars)) {
    throw new Error(`X402_PRICE_TINYBARS must be a positive whole number of tinybars, got "${priceTinybars}"`);
  }
  return {
    payTo,
    facilitatorUrl: process.env.X402_FACILITATOR_URL?.trim() || "https://api.testnet.blocky402.com",
    priceTinybars,
  };
}

/** x402Config for callers that render or respond: a malformed env becomes a readable error, not a 500. */
export function x402Setup(): { config: ReturnType<typeof x402Config>; error?: string } {
  try {
    return { config: x402Config() };
  } catch (e) {
    return { config: null, error: (e as Error).message };
  }
}

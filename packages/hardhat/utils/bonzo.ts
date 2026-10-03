/**
 * Bonzo Lend (Aave v2 fork) on Hedera testnet, 9 bps flash premium. Status 2026-10-03: testnet deposits
 * revert (CALLER_NOT_AUTHORIZED from the incentives controller), so reserves are empty; the mainnet pool
 * is paused (LP_IS_PAUSED).
 */
export const BONZO_TESTNET = {
  lendingPool: "0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2", // 0.0.4999355
} as const;

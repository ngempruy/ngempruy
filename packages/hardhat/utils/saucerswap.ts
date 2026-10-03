/** SaucerSwap V1 and token addresses on Hedera testnet (verified 2026-10-03). */
export const SAUCERSWAP_TESTNET = {
  router: "0x0000000000000000000000000000000000004b40", // RouterV3 0.0.19264
  whbarContract: "0x0000000000000000000000000000000000003aD1", // 0.0.15057: deposit() wraps HBAR
  whbar: "0x0000000000000000000000000000000000003aD2", // token 0.0.15058, 8 decimals
  usdc: "0x0000000000000000000000000000000000001549", // token 0.0.5449, 6 decimals (SaucerSwap / Bonzo testnet USDC)
} as const;

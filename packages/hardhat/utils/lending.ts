/** Hedera testnet addresses the lending module uses (verified 2026-10-03). */
export const LENDING_TESTNET = {
  whbar: "0x0000000000000000000000000000000000003aD2", // collateral, token 0.0.15058, 8 decimals
  whbarContract: "0x0000000000000000000000000000000000003aD1", // 0.0.15057: deposit() wraps HBAR
  usdc: "0x0000000000000000000000000000000000001549", // borrowed asset, token 0.0.5449, 6 decimals
  chainlinkHbarUsd: "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a", // 8 decimals
} as const;

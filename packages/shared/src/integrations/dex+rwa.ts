import { defineIntegration } from "../define";

export const dexRwa = defineIntegration({
  id: "dex+rwa",
  title: "RWA liquidity at NAV",
  description:
    "Creates the RWA/USDC pool on SaucerSwap with the KYC the token requires, and buys through NavBandSwap, which refuses pool prices too far above the appraised NAV.",
  when: ["dex", "rwa"],
  contracts: ["NavBandSwap"],
  paths: [
    "packages/shared/src/integrations/dex+rwa.ts",
    "packages/hardhat/contracts/integrations/dex-rwa",
    "packages/hardhat/deploy/50_dex_rwa.ts",
    "packages/hardhat/test/integrations/NavBandSwap.test.ts",
    "packages/hardhat/scripts/demo/dex+rwa.ts",
  ],
});

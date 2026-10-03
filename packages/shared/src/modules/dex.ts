import { defineModule } from "../define";

export const dex = defineModule({
  id: "dex",
  title: "DEX",
  description:
    "Token swaps on SaucerSwap V1 behind ISwapAdapter, so payments, RWA and flash loans never call a router directly.",
  requires: ["core"],
  provides: ["swap"],
  contracts: ["SaucerSwapAdapter"],
  paths: [
    "packages/shared/src/modules/dex.ts",
    "packages/hardhat/contracts/adapters/SaucerSwapAdapter.sol",
    "packages/hardhat/contracts/mocks/MockSaucerSwapRouter.sol",
    "packages/hardhat/deploy/20_dex_saucerswap_adapter.ts",
    "packages/hardhat/test/SaucerSwapAdapter.test.ts",
    "packages/hardhat/scripts/dexSwap.ts",
    "packages/hardhat/utils/saucerswap.ts",
    "packages/nextjs/modules/dex",
  ],
  scripts: ["dex:swap", "hardhat:dex:swap"],
});

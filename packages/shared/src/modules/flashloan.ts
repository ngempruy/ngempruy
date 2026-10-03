import { defineModule } from "../define";

export const flashloan = defineModule({
  id: "flashloan",
  title: "Flash Loans",
  description:
    "Borrow and repay in one transaction: SaucerSwap V1 flash swaps (live) or Bonzo Lend flash loans, running arbitrage or liquidation strategies through ISwapAdapter.",
  requires: ["core", "dex"],
  contracts: ["SaucerSwapFlashLoan", "BonzoFlashLoan"],
  paths: [
    "packages/shared/src/modules/flashloan.ts",
    "packages/hardhat/contracts/modules/flashloan",
    "packages/hardhat/contracts/mocks/MockBonzoLendingPool.sol",
    "packages/hardhat/contracts/mocks/MockSaucerSwapPair.sol",
    "packages/hardhat/contracts/mocks/MockSwapAdapter.sol",
    "packages/hardhat/deploy/40_flashloan.ts",
    "packages/hardhat/test/modules/BonzoFlashLoan.test.ts",
    "packages/hardhat/test/modules/SaucerSwapFlashLoan.test.ts",
    "packages/hardhat/scripts/flashloanDemo.ts",
    "packages/hardhat/utils/bonzo.ts",
    "packages/nextjs/modules/flashloan",
  ],
  scripts: ["flashloan:demo", "hardhat:flashloan:demo"],
});

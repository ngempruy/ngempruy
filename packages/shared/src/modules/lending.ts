import { defineModule } from "../define";

export const lending = defineModule({
  id: "lending",
  title: "Lending",
  description:
    "Overcollateralised USDC loans against WHBAR priced by Chainlink HBAR/USD. The market schedules its own health checks through HIP-1215 and liquidates on schedule, with no keeper bot.",
  requires: ["core"],
  provides: ["lending"],
  contracts: ["LendingMarket"],
  paths: [
    "packages/shared/src/modules/lending.ts",
    "packages/hardhat/contracts/modules/lending",
    "packages/hardhat/contracts/mocks/MockScheduleService.sol",
    "packages/hardhat/deploy/45_lending.ts",
    "packages/hardhat/test/modules/LendingMarket.test.ts",
    "packages/hardhat/scripts/demo/lending.ts",
    "packages/hardhat/utils/lending.ts",
    "packages/nextjs/modules/lending",
  ],
});

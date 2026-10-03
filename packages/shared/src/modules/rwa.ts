import { defineModule } from "../define";

export const rwa = defineModule({
  id: "rwa",
  title: "Real-World Assets",
  description:
    "Tokenise an asset as an HTS token with a KYC key held by a contract, and value it with an appraiser-fed NAV oracle.",
  requires: ["core"],
  contracts: ["RwaNavOracle", "RwaToken"],
  paths: [
    "packages/shared/src/modules/rwa.ts",
    "packages/hardhat/contracts/modules/rwa",
    "packages/hardhat/deploy/10_rwa.ts",
    "packages/hardhat/test/modules/RwaNavOracle.test.ts",
    "packages/hardhat/test/modules/RwaToken.test.ts",
    "packages/nextjs/modules/rwa",
  ],
});

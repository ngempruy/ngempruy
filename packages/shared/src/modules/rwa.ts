import { defineModule } from "../define";

export const rwa = defineModule({
  id: "rwa",
  title: "Real-World Assets",
  description:
    "Tokenise an asset as an HTS token with a KYC key held by a contract, and value it with an appraiser-fed NAV oracle.",
  requires: ["core"],
  contracts: ["RwaNavOracle", "RwaToken"],
});

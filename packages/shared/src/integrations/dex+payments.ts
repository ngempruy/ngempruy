import { defineIntegration } from "../define";

export const dexPayments = defineIntegration({
  id: "dex+payments",
  title: "Pay with any token",
  description:
    "SwapCheckout swaps whatever the payer holds into USDC on SaucerSwap, pays the merchant the exact price and refunds the surplus.",
  when: ["dex", "payments"],
  contracts: ["SwapCheckout"],
  paths: [
    "packages/shared/src/integrations/dex+payments.ts",
    "packages/hardhat/contracts/integrations/dex-payments",
    "packages/hardhat/deploy/55_dex_payments.ts",
    "packages/hardhat/test/integrations/SwapCheckout.test.ts",
    "packages/hardhat/scripts/demo/dex+payments.ts",
    "packages/nextjs/modules/dex+payments",
  ],
});

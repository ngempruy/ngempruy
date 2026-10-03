import { defineModule } from "../define";

export const payments = defineModule({
  id: "payments",
  title: "Payments",
  description:
    "x402 pay-per-request APIs settled as native Hedera transfers through a hosted facilitator, plus direct HBAR transfers.",
  requires: ["core"],
  paths: [
    "packages/shared/src/modules/payments.ts",
    "packages/nextjs/app/api/x402",
    "packages/nextjs/services/x402",
    "packages/nextjs/scripts/x402-pay.ts",
    "packages/nextjs/modules/payments",
  ],
  scripts: ["x402:pay"],
  dependencies: ["@x402/core", "@x402/fetch", "@x402/hedera", "@x402/next"],
  env: [
    { key: "X402_PAY_TO", description: "Hedera account id (0.0.x) that receives x402 payments", required: true },
    {
      key: "X402_FACILITATOR_URL",
      description: "x402 facilitator (default Blocky402 testnet: https://api.testnet.blocky402.com)",
      required: false,
    },
    {
      key: "X402_PRICE_TINYBARS",
      description: "Price per request in tinybars (default 1000000 = 0.01 HBAR)",
      required: false,
    },
  ],
});

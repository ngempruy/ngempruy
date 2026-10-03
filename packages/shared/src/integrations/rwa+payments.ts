import { defineIntegration } from "../define";

export const rwaPayments = defineIntegration({
  id: "rwa+payments",
  title: "Paid NAV reports",
  description:
    "Sells the RWA's latest NAV and appraisal history as an x402 pay-per-request API (GET /api/x402/nav-report).",
  when: ["rwa", "payments"],
  paths: ["packages/shared/src/integrations/rwa+payments.ts", "packages/nextjs/app/api/x402/nav-report"],
});

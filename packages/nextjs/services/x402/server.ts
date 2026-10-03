import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { x402ResourceServer } from "@x402/next";
import { postAuditEntry } from "~~/services/hedera/audit";
import { X402_NETWORK } from "./config";

/** Resource server bound to one facilitator; every settled payment lands in the HCS audit log. */
export function createResourceServer(facilitatorUrl: string) {
  return new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl }))
    .register(X402_NETWORK, new ExactHederaScheme())
    .onAfterSettle(async ({ result }) => {
      if (!result.success || !process.env.HEDERA_OPERATOR_ID) return;
      await postAuditEntry({
        module: "payments",
        action: "x402.settled",
        ref: result.transaction,
        data: { payer: result.payer ?? "unknown", network: result.network },
      }).catch(e => console.error("[x402] audit log failed", e));
    });
}

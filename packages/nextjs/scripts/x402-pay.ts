/**
 * Agent-side x402 client: calls a paid endpoint, pays the 402 with a partially signed Hedera
 * TransferTransaction (the facilitator co-signs as fee payer and submits), prints the result.
 *
 *   yarn x402:pay [url]   (payer = HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY from .env.local)
 * The client refuses any request priced above MAX_TINYBARS or in another asset.
 */
import { x402Client } from "@x402/core/client";
import { decodePaymentResponseHeader, wrapFetchWithPayment } from "@x402/fetch";
import { PrivateKey, createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

/** 0.1 HBAR. */
const MAX_TINYBARS = "10000000";

async function main() {
  const url = process.argv[2] ?? "http://localhost:3000/api/x402/hbar-usd";
  const payerId = process.env.HEDERA_OPERATOR_ID;
  const payerKey = process.env.HEDERA_OPERATOR_KEY;
  if (!payerId || !payerKey)
    throw new Error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in packages/nextjs/.env.local");

  const signer = createClientHederaSigner(payerId, PrivateKey.fromStringECDSA(payerKey.replace(/^0x/, "")), {
    network: "hedera:testnet",
  });
  const client = x402Client.fromConfig({
    schemes: [{ network: "hedera:*", client: new ExactHederaScheme(signer) }],
    // Agent guardrail: pay in HBAR only, never more than MAX_TINYBARS per request.
    spendControls: {
      allowedAssets: [{ network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: MAX_TINYBARS }],
    },
  });
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(url);
  console.log(`HTTP ${res.status}`, await res.json());
  const header = res.headers.get("PAYMENT-RESPONSE");
  if (header) {
    const settlement = decodePaymentResponseHeader(header);
    // HashScan wants 0.0.x-seconds-nanos rather than the SDK's 0.0.x@seconds.nanos.
    const txId = settlement.transaction.replace("@", "-").replace(/\.(\d+)$/, "-$1");
    console.log(`Settled ${settlement.transaction}: https://hashscan.io/testnet/transaction/${txId}`);
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

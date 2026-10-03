import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HBAR_ASSET, X402_NETWORK, x402Config } from "~~/services/x402/config";
import { createResourceServer } from "~~/services/x402/server";

const MIRROR = "https://testnet.mirrornode.hedera.com";

/** The paid resource: the network's current HBAR/USD exchange rate. */
async function handler(): Promise<NextResponse> {
  const res = await fetch(`${MIRROR}/api/v1/network/exchangerate`, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: `Mirror node returned HTTP ${res.status}` }, { status: 502 });
  const { current_rate: rate } = (await res.json()) as {
    current_rate: { cent_equivalent: number; hbar_equivalent: number; expiration_time: number };
  };
  return NextResponse.json({
    hbarUsd: rate.cent_equivalent / rate.hbar_equivalent / 100,
    validUntil: new Date(rate.expiration_time * 1000).toISOString(),
    source: `${MIRROR}/api/v1/network/exchangerate`,
  });
}

const config = x402Config();

export const GET = config
  ? withX402(
      handler,
      {
        accepts: [
          {
            scheme: "exact",
            network: X402_NETWORK,
            payTo: config.payTo,
            price: { asset: HBAR_ASSET, amount: config.priceTinybars },
          },
        ],
        description: "Current HBAR/USD exchange rate from the Hedera network",
        mimeType: "application/json",
      },
      createResourceServer(config.facilitatorUrl),
    )
  : async () => NextResponse.json({ error: "Payments module not configured: set X402_PAY_TO" }, { status: 503 });

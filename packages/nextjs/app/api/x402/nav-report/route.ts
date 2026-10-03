import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { type Hex, createPublicClient, decodeEventLog, formatUnits, http } from "viem";
import { hederaTestnet } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";
import { HBAR_ASSET, X402_NETWORK, x402Setup } from "~~/services/x402/config";
import { createResourceServer } from "~~/services/x402/server";

const MIRROR = "https://testnet.mirrornode.hedera.com";
const oracle = deployedContracts[hederaTestnet.id].RwaNavOracle;
const client = createPublicClient({ chain: hederaTestnet, transport: http() });

type MirrorLog = { data: Hex; topics: Hex[]; timestamp: string; transaction_hash: Hex };

/** The paid resource: current NAV plus the last appraisals, straight from chain data. */
async function handler(): Promise<NextResponse> {
  const read = (functionName: "nav" | "updatedAt" | "round") =>
    client.readContract({ address: oracle.address, abi: oracle.abi, functionName });
  const [nav, updatedAt, round] = await Promise.all([read("nav"), read("updatedAt"), read("round")]);

  const res = await fetch(`${MIRROR}/api/v1/contracts/${oracle.address}/results/logs?order=desc&limit=25`, {
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Mirror node returned HTTP ${res.status}` }, { status: 502 });
  const { logs } = (await res.json()) as { logs: MirrorLog[] };

  const history = logs.flatMap(log => {
    try {
      const event = decodeEventLog({ abi: oracle.abi, data: log.data, topics: log.topics as [Hex] });
      if (event.eventName !== "NavPosted" || !event.args) return [];
      return [
        {
          round: event.args.round.toString(),
          navUsd: formatUnits(event.args.navPerUnit, 18),
          reportUri: event.args.reportUri,
          appraiser: event.args.appraiser,
          at: new Date(Number(log.timestamp.split(".")[0]) * 1000).toISOString(),
          tx: log.transaction_hash,
        },
      ];
    } catch {
      return [];
    }
  });

  return NextResponse.json({
    oracle: oracle.address,
    navUsd: formatUnits(nav as bigint, 18),
    updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
    round: String(round),
    history,
  });
}

const { config, error } = x402Setup();

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
        description: "Latest NAV and appraisal history of the kit's RWA token",
        mimeType: "application/json",
      },
      createResourceServer(config.facilitatorUrl),
    )
  : async () =>
      NextResponse.json({ error: error ?? "Payments module not configured: set X402_PAY_TO" }, { status: 503 });

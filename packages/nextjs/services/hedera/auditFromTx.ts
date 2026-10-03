import { type Abi, type Hex, decodeEventLog } from "viem";
import { type AuditEntry, integrations, modules } from "@sh/shared";
import deployedContracts from "~~/contracts/deployedContracts";

const MIRROR = "https://testnet.mirrornode.hedera.com";
const TESTNET_CHAIN_ID = 296;

type MirrorContractResult = {
  result: string;
  to: string;
  logs: { address: string; data: Hex; topics: Hex[] }[];
};

/** Kit contract deployed at `address` on testnet, with the module or recipe that owns it. */
function kitContract(address: string) {
  const contracts = (deployedContracts as Record<number, Record<string, { address: string; abi: Abi }>>)[
    TESTNET_CHAIN_ID
  ];
  for (const [name, c] of Object.entries(contracts ?? {})) {
    if (c.address.toLowerCase() !== address.toLowerCase()) continue;
    const owner = [...modules, ...integrations].find(m => m.contracts.includes(name));
    return owner && { name, abi: c.abi, module: owner.id };
  }
}

/** Mirror node indexes a few seconds behind consensus. */
async function fetchContractResult(txHash: string): Promise<MirrorContractResult> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${MIRROR}/api/v1/contracts/results/${txHash}`, { cache: "no-store" });
    if (res.ok) return res.json();
    if (res.status !== 404) throw new Error(`Mirror node returned HTTP ${res.status}`);
    await new Promise(r => setTimeout(r, 2_000));
  }
  throw new Error(`Transaction ${txHash} not found on the mirror node`);
}

/**
 * Turns a successful call to a kit contract into audit entries, one per emitted kit event.
 * Entries are derived from on-chain data only, so callers cannot forge them.
 */
export async function auditEntriesFromTx(txHash: string): Promise<AuditEntry[]> {
  const result = await fetchContractResult(txHash);
  if (result.result !== "SUCCESS") throw new Error(`Transaction ${txHash} did not succeed (${result.result})`);
  if (!kitContract(result.to)) throw new Error(`Transaction ${txHash} is not a call to a kit contract`);

  return result.logs.flatMap(log => {
    const contract = kitContract(log.address);
    if (!contract) return [];
    try {
      const { eventName, args } = decodeEventLog({ abi: contract.abi, data: log.data, topics: log.topics as [Hex] });
      const data = Object.fromEntries(
        Object.entries((args ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
      );
      return [{ module: contract.module, action: `${contract.name}.${eventName}`, ref: txHash, data }];
    } catch {
      return []; // not an event in the contract's ABI (e.g. an HTS log)
    }
  });
}

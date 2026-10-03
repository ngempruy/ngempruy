/** One entry in the HCS audit log. Every module writes this shape. */
export type AuditEntry = {
  module: string;
  action: string;
  /** Primary on-chain reference: token id, contract address, transaction id. */
  ref?: string;
  data?: Record<string, string | number | boolean>;
};

/** A single HCS message chunk carries at most 1024 bytes. */
export const HCS_MAX_MESSAGE_BYTES = 1024;

/** Serialises an audit entry with a timestamp; rejects anything that needs chunking. */
export function encodeAuditEntry(entry: AuditEntry, now = new Date()): string {
  if (!entry.module || !entry.action) throw new Error("Audit entry needs a module and an action");
  const json = JSON.stringify({ v: 1, ts: now.toISOString(), ...entry });
  const size = new TextEncoder().encode(json).length;
  if (size > HCS_MAX_MESSAGE_BYTES) {
    throw new Error(`Audit entry is ${size} bytes; the limit is ${HCS_MAX_MESSAGE_BYTES}. Put bulk data off-chain.`);
  }
  return json;
}

/** Parses a mirror-node message (base64) back into an entry; returns null for foreign messages. */
export function decodeAuditMessage(base64: string): (AuditEntry & { ts: string }) | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0))));
    return parsed?.v === 1 && typeof parsed.module === "string" && typeof parsed.action === "string" ? parsed : null;
  } catch {
    return null;
  }
}

const HASHSCAN_NETWORK: Record<number, string> = { 295: "mainnet", 296: "testnet" };

/** HashScan link for a Hedera entity or transaction on chain 295/296. */
export function hashscanUrl(
  chainId: number,
  kind: "topic" | "token" | "contract" | "account" | "transaction",
  id: string,
) {
  return `https://hashscan.io/${HASHSCAN_NETWORK[chainId] ?? "testnet"}/${kind}/${id}`;
}

/**
 * The audit entry for one event emitted by a kit contract. Shared by the web app (/api/audit)
 * and the scripts so both write the same shape for the same on-chain fact.
 */
export function auditEntryFromEvent(
  module: string,
  contract: string,
  event: { name: string; args: Record<string, unknown> },
  txHash: string,
): AuditEntry {
  const data = Object.fromEntries(Object.entries(event.args).map(([k, v]) => [k, String(v)]));
  return { module, action: `${contract}.${event.name}`, ref: txHash, data };
}

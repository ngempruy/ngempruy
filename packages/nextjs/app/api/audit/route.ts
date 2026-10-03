import { NextResponse } from "next/server";
import { postAuditEntry } from "~~/services/hedera/audit";
import { auditEntriesFromTx } from "~~/services/hedera/auditFromTx";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

// ponytail: per-process dedupe; a restart or a second instance can log a tx twice. Use a KV store if that matters.
// A hash is claimed before the first await so concurrent requests for one tx write once.
const claimed = new Set<string>();

/** Records the kit events of a confirmed transaction in the HCS audit log. */
export async function POST(req: Request) {
  const { txHash } = (await req.json().catch(() => ({}))) as { txHash?: string };
  if (!txHash || !TX_HASH_RE.test(txHash)) {
    return NextResponse.json({ error: "Body must be { txHash: 0x… }" }, { status: 400 });
  }
  if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
    return NextResponse.json({ error: "Audit log disabled: set HEDERA_OPERATOR_ID/KEY" }, { status: 503 });
  }
  const key = txHash.toLowerCase();
  if (claimed.has(key)) return NextResponse.json({ entries: [] });
  claimed.add(key);

  try {
    const entries = await auditEntriesFromTx(key);
    const posted = [];
    for (const entry of entries) posted.push({ ...entry, ...(await postAuditEntry(entry)) });
    return NextResponse.json({ entries: posted });
  } catch (e) {
    claimed.delete(key); // let the caller retry
    const message = (e as Error).message;
    if (message.includes("INVALID_SIGNATURE")) {
      const hint = "HEDERA_OPERATOR_KEY is not the audit topic's submit key; deploy your own topic or use that key";
      return NextResponse.json({ error: `${message} (${hint})` }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

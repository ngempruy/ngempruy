import { NextResponse } from "next/server";
import { postAuditEntry } from "~~/services/hedera/audit";
import { auditEntriesFromTx } from "~~/services/hedera/auditFromTx";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

// ponytail: per-process dedupe; a restart or a second instance can log a tx twice. Use a KV store if that matters.
const logged = new Set<string>();

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
  if (logged.has(key)) return NextResponse.json({ entries: [] });

  try {
    const entries = await auditEntriesFromTx(key);
    logged.add(key);
    const posted = [];
    for (const entry of entries) posted.push({ ...entry, ...(await postAuditEntry(entry)) });
    return NextResponse.json({ entries: posted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

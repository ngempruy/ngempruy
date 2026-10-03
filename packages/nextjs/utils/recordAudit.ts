/** Asks the server to log a confirmed kit transaction to HCS; returns a status line for the UI. */
export async function recordAudit(txHash: string): Promise<string> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  const body = (await res.json()) as { entries?: { action: string; sequenceNumber?: string }[]; error?: string };
  if (!res.ok) return `Transaction confirmed; audit log skipped: ${body.error}`;
  const logged = body.entries?.map(e => `${e.action} (#${e.sequenceNumber})`).join(", ");
  return logged ? `Logged to HCS: ${logged}` : "Transaction confirmed.";
}

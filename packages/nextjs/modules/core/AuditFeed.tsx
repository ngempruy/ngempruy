import { decodeAuditMessage, hashscanUrl } from "@sh/shared";
import { auditTopicId } from "~~/services/hedera/resources";

const TESTNET_CHAIN_ID = 296;
const MIRROR = "https://testnet.mirrornode.hedera.com";

type MirrorMessage = { consensus_timestamp: string; sequence_number: number; message: string };

/** Latest audit entries, read from the mirror node. Needs no key or wallet. */
export const AuditFeed = async () => {
  const topicId = auditTopicId(TESTNET_CHAIN_ID);
  if (!topicId) {
    return (
      <p className="m-0 text-sm">
        No audit topic yet. Deploy with <code>yarn hardhat:deploy --network hederaTestnet</code> to create one.
      </p>
    );
  }

  // The page must render even when the mirror node is slow or unreachable.
  let messages: MirrorMessage[];
  try {
    const res = await fetch(`${MIRROR}/api/v1/topics/${topicId}/messages?order=desc&limit=25`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return <p className="text-error m-0 text-sm">Mirror node returned HTTP {res.status}.</p>;
    ({ messages } = (await res.json()) as { messages: MirrorMessage[] });
  } catch {
    return <p className="text-error m-0 text-sm">Mirror node unreachable; reload to retry.</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-xl font-bold">
        Audit log{" "}
        <a className="link text-sm font-normal" href={hashscanUrl(TESTNET_CHAIN_ID, "topic", topicId)} target="_blank">
          {topicId}
        </a>
      </h2>
      {messages.length === 0 ? (
        <p className="m-0 text-sm">No entries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-sm table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Module</th>
                <th>Action</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {messages.map(m => {
                const entry = decodeAuditMessage(m.message);
                return (
                  <tr key={m.sequence_number}>
                    <td>{m.sequence_number}</td>
                    <td>{new Date(Number(m.consensus_timestamp.split(".")[0]) * 1000).toISOString()}</td>
                    <td>{entry?.module ?? "—"}</td>
                    <td>{entry?.action ?? "(not an audit entry)"}</td>
                    <td className="font-mono text-xs">{entry?.ref ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

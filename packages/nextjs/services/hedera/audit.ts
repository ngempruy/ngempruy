import { auditTopicId } from "./resources";
import { TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { type AuditEntry, encodeAuditEntry } from "@sh/shared";
import { operatorClient } from "~~/services/hedera/operator";

const TESTNET_CHAIN_ID = 296;

/** Appends an entry to the HCS audit topic. Server-side only (uses the operator key). */
export async function postAuditEntry(entry: AuditEntry) {
  const topicId = auditTopicId(TESTNET_CHAIN_ID);
  if (!topicId)
    throw new Error("No audit topic. Run `yarn deploy --network hederaTestnet` or set NEXT_PUBLIC_AUDIT_TOPIC_ID.");

  const message = encodeAuditEntry(entry);
  const { client } = operatorClient();
  try {
    const response = await new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(message).execute(client);
    const receipt = await response.getReceipt(client);
    return {
      topicId,
      sequenceNumber: receipt.topicSequenceNumber?.toString(),
      transactionId: response.transactionId.toString(),
    };
  } finally {
    client.close();
  }
}

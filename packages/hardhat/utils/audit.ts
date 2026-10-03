import { TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import type { BaseContract, TransactionReceipt } from "ethers";
import { type AuditEntry, auditEntryFromEvent, encodeAuditEntry, integrations, modules } from "@sh/shared";
import { readHederaResources, sdkClientFromDeployer } from "./hedera";

/** Audit entries for the events `contract` emitted in `receipt`, tagged with the owning module. */
export function auditEntriesFromReceipt(name: string, contract: BaseContract, receipt: TransactionReceipt) {
  const owner = [...modules, ...integrations].find(m => m.contracts.includes(name));
  if (!owner) return [];
  return receipt.logs.flatMap(log => {
    if (log.address.toLowerCase() !== String(contract.target).toLowerCase()) return [];
    const parsed = contract.interface.parseLog(log);
    if (!parsed) return [];
    const args = Object.fromEntries(parsed.fragment.inputs.map((input, i) => [input.name, parsed.args[i]]));
    return [auditEntryFromEvent(owner.id, name, { name: parsed.name, args }, receipt.hash)];
  });
}

/** Writes entries to the audit topic recorded by the core deploy step; returns their sequence numbers. */
export async function postAuditEntries(chainId: number, privateKey: string, entries: AuditEntry[]) {
  const topicId = readHederaResources(chainId).auditTopicId;
  if (!topicId || entries.length === 0) return [];
  const { client } = await sdkClientFromDeployer(chainId, privateKey);
  try {
    const sequenceNumbers: string[] = [];
    for (const entry of entries) {
      const response = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(encodeAuditEntry(entry))
        .execute(client);
      sequenceNumbers.push(String((await response.getReceipt(client)).topicSequenceNumber));
    }
    return sequenceNumbers;
  } finally {
    client.close();
  }
}

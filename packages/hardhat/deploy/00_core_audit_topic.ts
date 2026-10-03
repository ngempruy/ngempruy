import { TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { encodeAuditEntry } from "@sh/shared";
import { MIRROR_NODE, readHederaResources, sdkClientFromDeployer, writeHederaResources } from "../utils/hedera";

/**
 * Core: creates the HCS topic every module writes its audit entries to.
 * Only the deployer key may submit (submitKey), anyone can read via the mirror node.
 */
const deployAuditTopic: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = Number(await hre.getChainId());
  if (!MIRROR_NODE[chainId]) {
    console.log("Skipping HCS audit topic: HCS is not available on the local network");
    return;
  }
  const privateKey = process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
  if (!privateKey)
    throw new Error("Deployer key missing. Run the deploy through `yarn hardhat:deploy` so it gets decrypted.");

  const { client, key } = await sdkClientFromDeployer(chainId, privateKey);
  try {
    // A recorded topic (e.g. the one committed with the template) is only reusable if this deployer can write to it.
    const existing = readHederaResources(chainId).auditTopicId;
    if (existing) {
      const submitKey = await topicSubmitKey(chainId, existing);
      if (submitKey === key.publicKey.toStringRaw()) {
        console.log(`Reusing HCS audit topic ${existing}`);
        return;
      }
      console.log(`HCS audit topic ${existing} belongs to another deployer, creating your own`);
    }

    const response = await new TopicCreateTransaction()
      .setTopicMemo("hedera-defi-kit audit log")
      .setAdminKey(key.publicKey)
      .setSubmitKey(key.publicKey)
      .execute(client);
    const { topicId } = await response.getReceipt(client);
    if (!topicId) throw new Error("Topic creation returned no topic id");

    writeHederaResources(chainId, { auditTopicId: topicId.toString() });
    await (
      await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(encodeAuditEntry({ module: "core", action: "audit.topic.created", ref: topicId.toString() }))
        .execute(client)
    ).getReceipt(client);
    const network = chainId === 295 ? "mainnet" : "testnet";
    console.log(`HCS audit topic ${topicId}: https://hashscan.io/${network}/topic/${topicId}`);
  } finally {
    client.close();
  }
};

/** Raw public key allowed to submit to `topicId`, from the mirror node (undefined if the topic has none). */
async function topicSubmitKey(chainId: number, topicId: string): Promise<string | undefined> {
  const res = await fetch(`${MIRROR_NODE[chainId]}/api/v1/topics/${topicId}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`Mirror node lookup for topic ${topicId} failed with HTTP ${res.status}`);
  const { submit_key } = (await res.json()) as { submit_key: { key: string } | null };
  return submit_key?.key;
}

deployAuditTopic.tags = ["core"];
export default deployAuditTopic;

import { TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { encodeAuditEntry } from "@sh/shared";
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
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
  const existing = readHederaResources(chainId).auditTopicId;
  if (existing) {
    console.log(`Reusing HCS audit topic ${existing}`);
    return;
  }

  const privateKey = process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("Deployer key missing. Run the deploy through `yarn deploy` so it gets decrypted.");

  const { client, key } = await sdkClientFromDeployer(chainId, privateKey);
  try {
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

deployAuditTopic.tags = ["core"];
export default deployAuditTopic;

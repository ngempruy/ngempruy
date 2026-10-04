/**
 * yarn demo: runs every module's demo step (scripts/demo/<module>.ts) against Hedera testnet,
 * printing a HashScan link per transaction and logging kit events to the HCS audit topic.
 * Needs a deployment first (`yarn hardhat:deploy --network hederaTestnet`). `DEMO_ONLY=<step,…>` limits the steps.
 */
import type { BaseContract, ContractTransactionResponse, TransactionResponse } from "ethers";
import * as fs from "fs";
import hre from "hardhat";
import * as path from "path";
import { auditEntriesFromReceipt, postAuditEntries } from "../utils/audit";
import { MIRROR_NODE, readHederaResources } from "../utils/hedera";

export type DemoContext = {
  hre: typeof hre;
  /** Waits for the tx, prints its HashScan link and, for kit contracts, logs its events to HCS. */
  send: (
    label: string,
    tx: Promise<TransactionResponse | ContractTransactionResponse>,
    kitContract?: { name: string; contract: BaseContract },
  ) => Promise<void>;
};

async function main() {
  const chainId = Number(await hre.getChainId());
  if (!MIRROR_NODE[chainId]) throw new Error("Run the demo against hederaTestnet: yarn demo");
  const privateKey = process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("Deployer key missing; run it with `yarn demo`");
  const network = chainId === 295 ? "mainnet" : "testnet";
  const { auditTopicId } = readHederaResources(chainId);

  const ctx: DemoContext = {
    hre,
    send: async (label, tx, kitContract) => {
      const response = await tx;
      const receipt = await response.wait();
      if (!receipt || receipt.status !== 1) throw new Error(`${label} failed (${response.hash})`);
      console.log(`  ✓ ${label}\n    https://hashscan.io/${network}/transaction/${response.hash}`);
      if (!kitContract) return;
      const entries = auditEntriesFromReceipt(kitContract.name, kitContract.contract, receipt);
      try {
        const seq = await postAuditEntries(chainId, privateKey, entries);
        if (seq.length) console.log(`    audit #${seq.join(", #")}: ${entries.map(e => e.action).join(", ")}`);
      } catch (e) {
        // The on-chain step succeeded; a missing or foreign audit topic shouldn't abort the demo.
        console.warn(`    ⚠ audit log skipped: ${e instanceof Error ? e.message : e}`);
      }
    },
  };

  // DEMO_ONLY=lending,dex+payments runs just those steps (e.g. when other modules aren't deployed by you).
  const only = process.env.DEMO_ONLY?.split(",").map(s => s.trim());
  const steps = fs
    .readdirSync(path.join(__dirname, "demo"))
    .filter(f => f.endsWith(".ts") && (!only || only.includes(path.basename(f, ".ts"))))
    .sort();
  for (const file of steps) {
    console.log(`\n${path.basename(file, ".ts")}`);
    const step = (await import(path.join(__dirname, "demo", file))).default as (ctx: DemoContext) => Promise<void>;
    await step(ctx);
  }
  if (auditTopicId) console.log(`\nAudit log: https://hashscan.io/${network}/topic/${auditTopicId}`);
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

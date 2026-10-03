import { AccountId, Client, PrivateKey } from "@hiero-ledger/sdk";
import * as fs from "fs";
import * as path from "path";

export const MIRROR_NODE: Record<number, string> = {
  295: "https://mainnet-public.mirrornode.hedera.com",
  296: "https://testnet.mirrornode.hedera.com",
};

/**
 * Builds a Hedera SDK client from the (decrypted) EVM deployer key. The account id is
 * looked up on the mirror node, so the key must already back a funded account
 * (faucet funding an EVM address creates one). Hedera EVM accounts use ECDSA keys.
 */
export async function sdkClientFromDeployer(chainId: number, privateKeyHex: string) {
  const mirror = MIRROR_NODE[chainId];
  if (!mirror) throw new Error(`No Hedera mirror node for chain ${chainId}`);
  const key = PrivateKey.fromStringECDSA(privateKeyHex.replace(/^0x/, ""));
  const evmAddress = `0x${key.publicKey.toEvmAddress()}`;

  const res = await fetch(`${mirror}/api/v1/accounts/${evmAddress}`);
  if (res.status === 404) {
    throw new Error(`Deployer ${evmAddress} has no Hedera account yet. Fund it at https://portal.hedera.com/faucet.`);
  }
  if (!res.ok) throw new Error(`Mirror node lookup for ${evmAddress} failed with HTTP ${res.status}`);
  const { account } = (await res.json()) as { account: string };

  const client = chainId === 295 ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(account), key);
  return { client, accountId: account, key };
}

/** Hedera-native ids (topics, HTS tokens) per chain, read by the frontend. */
export type HederaResources = { auditTopicId?: string; rwaTokenId?: string };

const RESOURCES_FILE = path.join(__dirname, "../../nextjs/contracts/hederaResources.json");

export function readHederaResources(chainId: number): HederaResources {
  if (!fs.existsSync(RESOURCES_FILE)) return {};
  return JSON.parse(fs.readFileSync(RESOURCES_FILE, "utf8"))[chainId] ?? {};
}

export function writeHederaResources(chainId: number, update: HederaResources) {
  const all = fs.existsSync(RESOURCES_FILE) ? JSON.parse(fs.readFileSync(RESOURCES_FILE, "utf8")) : {};
  all[chainId] = { ...all[chainId], ...update };
  fs.writeFileSync(RESOURCES_FILE, JSON.stringify(all, null, 2) + "\n");
}

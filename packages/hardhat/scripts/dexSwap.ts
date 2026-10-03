import { deployments, ethers, network } from "hardhat";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/**
 * Wraps 1 HBAR and swaps it to USDC through the deployed SaucerSwapAdapter, then prints the
 * HashScan link. Run with `yarn hardhat:dex:swap --network hederaTestnet` after `yarn hardhat:deploy --network hederaTestnet --tags dex`.
 */
const WRAP_HBAR = ethers.parseEther("1"); // JSON-RPC values are weibar: 1e18 per HBAR
const WHBAR_AMOUNT = 100_000_000n; // 1 WHBAR, 8 decimals
const SLIPPAGE_BPS = 100n;
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

async function isAssociated(account: string, token: string): Promise<boolean> {
  const tokenId = `0.0.${BigInt(token)}`;
  const res = await fetch(`${MIRROR}/accounts/${account}/tokens?token.id=${tokenId}`);
  if (res.status === 404) throw new Error(`Account ${account} not found on the mirror node. Fund it first.`);
  const body = (await res.json()) as { tokens: unknown[] };
  return body.tokens.length > 0;
}

async function main() {
  if (network.name !== "hederaTestnet") throw new Error("Run with --network hederaTestnet");
  const [signer] = await ethers.getSigners();
  const adapter = await ethers.getContractAt("SaucerSwapAdapter", (await deployments.get("SaucerSwapAdapter")).address);

  // HIP-719: an EOA associates itself by calling associate() on the token.
  for (const token of [SAUCERSWAP_TESTNET.whbar, SAUCERSWAP_TESTNET.usdc]) {
    if (await isAssociated(signer.address, token)) continue;
    const hrc719 = await ethers.getContractAt(["function associate() returns (int64)"], token);
    await (await hrc719.associate({ gasLimit: 1_000_000 })).wait();
    console.log(`Associated ${token}`);
  }

  const whbarContract = await ethers.getContractAt(["function deposit() payable"], SAUCERSWAP_TESTNET.whbarContract);
  await (await whbarContract.deposit({ value: WRAP_HBAR, gasLimit: 300_000 })).wait();

  const whbar = await ethers.getContractAt("IERC20", SAUCERSWAP_TESTNET.whbar);
  await (await whbar.approve(await adapter.getAddress(), WHBAR_AMOUNT, { gasLimit: 1_000_000 })).wait();

  const path = [SAUCERSWAP_TESTNET.whbar, SAUCERSWAP_TESTNET.usdc];
  const quoted = await adapter.quote(WHBAR_AMOUNT, path);
  const minOut = (quoted * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const tx = await adapter.swap(WHBAR_AMOUNT, minOut, path, signer.address, deadline, { gasLimit: 2_000_000 });
  await tx.wait();
  console.log(`Swapped 1 WHBAR → ~${ethers.formatUnits(quoted, 6)} USDC`);
  console.log(`https://hashscan.io/testnet/transaction/${tx.hash}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

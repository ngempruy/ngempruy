import { ethers } from "hardhat";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

/** Associates an EOA with each HTS token it isn't associated with yet (HIP-719 `associate()` on the token). */
export async function ensureAssociated(account: string, tokens: readonly string[]) {
  for (const token of tokens) {
    const res = await fetch(`${MIRROR}/accounts/${account}/tokens?token.id=0.0.${BigInt(token)}`);
    if (res.status === 404) throw new Error(`Account ${account} not found on the mirror node. Fund it first.`);
    const { tokens: held } = (await res.json()) as { tokens: unknown[] };
    if (held.length > 0) continue;

    const hrc719 = await ethers.getContractAt(["function associate() returns (int64)"], token);
    await (await hrc719.associate({ gasLimit: 1_000_000 })).wait();
    console.log(`Associated ${token}`);
  }
}

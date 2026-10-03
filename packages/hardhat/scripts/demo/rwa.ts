import type { DemoContext } from "../demo";

/** HTS rejects KYC for accounts that are not associated, so the order is fixed: associate → KYC → issue. */
export default async function rwaDemo({ hre, send }: DemoContext) {
  const { ethers, deployments } = hre;
  const [deployer] = await ethers.getSigners();
  const rwa = await ethers.getContractAt("RwaToken", (await deployments.get("RwaToken")).address, deployer);
  const oracle = await ethers.getContractAt("RwaNavOracle", (await deployments.get("RwaNavOracle")).address, deployer);
  const token = await rwa.token();

  // A fresh investor per run; funding an unknown EVM address creates its Hedera account.
  const investor = ethers.Wallet.createRandom().connect(ethers.provider);
  await send(
    `fund investor ${investor.address} with 5 HBAR`,
    deployer.sendTransaction({ to: investor.address, value: ethers.parseEther("5") }),
  );

  const hrc719 = new ethers.Contract(token, ["function associate() returns (uint256)"], investor);
  await send("investor associates the RWA token (HIP-719)", hrc719.associate({ gasLimit: 1_000_000 }));

  const kit = { name: "RwaToken", contract: rwa };
  await send("compliance grants KYC", rwa.grantKyc(investor.address, { gasLimit: 400_000 }), kit);
  await send("issuer issues 10 units", rwa.issue(investor.address, 10_000_000n, { gasLimit: 600_000 }), kit);

  const nav = await oracle.nav();
  const next = nav === 0n ? ethers.parseUnits("100", 18) : (nav * 101n) / 100n;
  await send(`appraiser posts NAV $${ethers.formatUnits(next, 18)}`, oracle.postNav(next, "ipfs://demo-appraisal"), {
    name: "RwaNavOracle",
    contract: oracle,
  });
}

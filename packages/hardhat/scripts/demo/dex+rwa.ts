import { SAUCERSWAP_TESTNET } from "../../utils/saucerswap";
import type { DemoContext } from "../demo";

/** A fresh buyer gets USDC, then buys RWA units through NavBandSwap, which only fills near NAV. */
export default async function dexRwaDemo({ hre, send }: DemoContext) {
  const { ethers, deployments } = hre;
  const [deployer] = await ethers.getSigners();
  const { usdc, whbar, router } = SAUCERSWAP_TESTNET;
  const rwa = await ethers.getContractAt("RwaToken", (await deployments.get("RwaToken")).address, deployer);
  const guardAddress = (await deployments.get("NavBandSwap")).address;
  const token = await rwa.token();
  const deadline = () => Math.floor(Date.now() / 1000) + 600;

  const buyer = ethers.Wallet.createRandom().connect(ethers.provider);
  await send(
    `fund buyer ${buyer.address} with 15 HBAR`,
    deployer.sendTransaction({ to: buyer.address, value: ethers.parseEther("15") }),
  );
  for (const [name, address] of [
    ["RWA token", token],
    ["USDC", usdc],
  ]) {
    const hrc719 = new ethers.Contract(address, ["function associate() returns (uint256)"], buyer);
    await send(`buyer associates ${name} (HIP-719)`, hrc719.associate({ gasLimit: 1_000_000 }));
  }
  await send("compliance grants the buyer KYC", rwa.grantKyc(buyer.address, { gasLimit: 400_000 }), {
    name: "RwaToken",
    contract: rwa,
  });

  const saucer = new ethers.Contract(
    router,
    ["function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])"],
    buyer,
  );
  await send(
    "buyer swaps 5 HBAR for USDC on SaucerSwap",
    saucer.swapExactETHForTokens(0, [whbar, usdc], buyer.address, deadline(), {
      value: ethers.parseEther("5"),
      gasLimit: 1_000_000,
    }),
  );

  const guard = await ethers.getContractAt("NavBandSwap", guardAddress, buyer);
  const quote = new ethers.Contract(usdc, ["function approve(address,uint256) returns (bool)"], buyer);
  const band = await guard.bandBps();
  await send("buyer approves 1 USDC to NavBandSwap", quote.approve(guardAddress, 1_000_000n));
  // Earlier demo runs move this thin pool; buy the largest size that still fills within the band.
  const size = await (async () => {
    for (const amount of [1_000_000n, 250_000n, 50_000n]) {
      const [, , premium] = await guard.previewBuy(amount);
      if (premium <= band) return { amount, premium };
    }
  })();
  if (size) {
    await send(
      `buyer buys with ${ethers.formatUnits(size.amount, 6)} USDC at ${size.premium} bps vs NAV`,
      guard.buy(size.amount, 0, deadline(), { gasLimit: 2_000_000 }),
      { name: "NavBandSwap", contract: guard },
    );
  } else {
    console.log(`  ✗ the pool trades more than ${band} bps above NAV at every size; NavBandSwap refuses to buy`);
  }

  // A large order moves the thin pool far above NAV; the guard refuses it before any token moves.
  const [, , bigPremium] = await guard.previewBuy(50_000_000n);
  console.log(
    `  ✗ 50 USDC would pay ${bigPremium} bps over NAV; NavBandSwap.buy reverts AboveNavBand (limit ${await guard.bandBps()})`,
  );
}

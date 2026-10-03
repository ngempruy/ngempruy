import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { writeHederaResources } from "../utils/hedera";
import { ensureAssociated } from "../utils/hts";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/** Seed liquidity: 1 unit at NAV ($100) against 100 USDC. */
const SEED_UNITS = 1_000_000n; // 6 decimals
const SEED_USDC = 100_000_000n; // 6 decimals
/** NavBandSwap refuses to pay more than 2% above a NAV younger than 30 days. */
const BAND_BPS = 200;
const MAX_NAV_AGE = 30 * 86_400;

const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[])",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)",
];
const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
  "function pairCreateFee() view returns (uint256)",
  "function createPair(address tokenA, address tokenB) payable returns (address)",
];

/**
 * Recipe dex+rwa: an RWA/USDC pool on SaucerSwap V1 that respects the token's KYC key, and the
 * NavBandSwap guard that buys from it only near NAV. Testnet only.
 */
const deployDexRwa: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre;
  const { deployer } = await hre.getNamedAccounts();
  const signer = await ethers.getSigner(deployer);
  const { usdc, whbar, router: routerAddress } = SAUCERSWAP_TESTNET;
  const deadline = () => Math.floor(Date.now() / 1000) + 600;

  const rwa = await ethers.getContractAt("RwaToken", (await deployments.get("RwaToken")).address, signer);
  const token = await rwa.token();

  const guard = await deployments.deploy("NavBandSwap", {
    from: deployer,
    args: [
      (await deployments.get("SaucerSwapAdapter")).address,
      (await deployments.get("RwaNavOracle")).address,
      token,
      6,
      usdc,
      6,
      MAX_NAV_AGE,
      BAND_BPS,
    ],
    log: true,
    gasLimit: 3_000_000,
  });
  if (guard.newlyDeployed)
    await deployments.execute("NavBandSwap", { from: deployer, gasLimit: 1_000_000 }, "associateQuoteToken");

  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
  const factory = new ethers.Contract(await router.factory(), FACTORY_ABI, signer);
  let pair: string = await factory.getPair(token, usdc);
  if (pair === ethers.ZeroAddress) {
    // The fee is priced in USD (tinycents); the exchange-rate system contract converts it to tinybars.
    const rate = new ethers.Contract("0x0000000000000000000000000000000000000168", [
      "function tinycentsToTinybars(uint256) returns (uint256)",
    ]).connect(signer) as unknown as { tinycentsToTinybars: { staticCall: (v: bigint) => Promise<bigint> } };
    const tinybars = await rate.tinycentsToTinybars.staticCall(await factory.pairCreateFee());
    const value = ((tinybars * 12n) / 10n) * 10_000_000_000n; // +20% for rate drift; weibars
    await (await factory.createPair(token, usdc, { value, gasLimit: 8_000_000 })).wait();
    pair = await factory.getPair(token, usdc);
    // The pair holds the KYC-gated token, so it needs KYC like any holder.
    await (await rwa.grantKyc(pair, { gasLimit: 400_000 })).wait();
    console.log(`RWA/USDC pair ${pair}: https://hashscan.io/testnet/contract/${pair}`);
  }

  const lpToken: string = await new ethers.Contract(
    pair,
    ["function lpToken() view returns (address)"],
    signer,
  ).lpToken();
  await ensureAssociated(deployer, [token, usdc, lpToken]);
  const erc20 = (address: string) =>
    new ethers.Contract(
      address,
      ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"],
      signer,
    );
  const lp = erc20(lpToken);
  if ((await lp.balanceOf(deployer)) === 0n) {
    await (await rwa.grantKyc(deployer, { gasLimit: 400_000 })).wait();
    await (await rwa.issue(deployer, SEED_UNITS, { gasLimit: 600_000 })).wait();
    if ((await erc20(usdc).balanceOf(deployer)) < SEED_USDC) {
      // Buy the USDC side from the live WHBAR/USDC pool; getAmountsIn returns tinybars (WHBAR has 8 decimals).
      const [tinybars] = await router.getAmountsIn(SEED_USDC, [whbar, usdc]);
      const value = (((tinybars as bigint) * 102n) / 100n) * 10_000_000_000n; // +2% slippage, in weibars
      await (
        await router.swapExactETHForTokens(SEED_USDC, [whbar, usdc], deployer, deadline(), {
          value,
          gasLimit: 1_000_000,
        })
      ).wait();
    }
    await (await erc20(token).approve(routerAddress, SEED_UNITS)).wait();
    await (await erc20(usdc).approve(routerAddress, SEED_USDC)).wait();
    const tx = await router.addLiquidity(token, usdc, SEED_UNITS, SEED_USDC, 0, 0, deployer, deadline(), {
      gasLimit: 2_000_000,
    });
    await tx.wait();
    console.log(`Seeded 1 unit / 100 USDC at NAV: https://hashscan.io/testnet/transaction/${tx.hash}`);
  }
  writeHederaResources(Number(await hre.getChainId()), { rwaUsdcPair: pair });
};

deployDexRwa.tags = ["dex+rwa"];
deployDexRwa.dependencies = ["rwa", "dex"];
deployDexRwa.skip = async hre => hre.network.name !== "hederaTestnet";
export default deployDexRwa;

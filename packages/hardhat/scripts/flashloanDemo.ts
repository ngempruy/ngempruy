import { deployments, ethers, network } from "hardhat";
import { ensureAssociated } from "../utils/hts";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/**
 * One flash loan round-trip on testnet: flash-borrow WHBAR from the SaucerSwap WHBAR/USDC pair, swap
 * WHBAR → SAUCE → WHBAR through the WHBAR/SAUCE pair (the source pair is locked during the loan), and
 * repay with the 0.3% fee. One route has no arbitrage, so the owner covers the cost (fee + swap fees)
 * up to MAX_COST; with a real price gap you pass a positive minPnl instead.
 *
 *   yarn hardhat:deploy:testnet --tags flashloan   (npm: npm run hardhat:deploy:testnet -- --tags flashloan)
 *   yarn hardhat:flashloan:demo
 */
const LOAN = 100_000_000n; // 1 WHBAR (8 decimals)
const MAX_COST = 5_000_000n; // 0.05 WHBAR
const TINYBAR_TO_WEIBAR = 10_000_000_000n; // JSON-RPC values are weibar (1e18 per HBAR)

async function main() {
  if (network.name !== "hederaTestnet") throw new Error("Run with --network hederaTestnet");
  const [signer] = await ethers.getSigners();
  const { whbar: WHBAR, usdc: USDC, sauce: SAUCE } = SAUCERSWAP_TESTNET;
  const flash = await ethers.getContractAt(
    "SaucerSwapFlashLoan",
    (await deployments.get("SaucerSwapFlashLoan")).address,
  );
  const whbar = await ethers.getContractAt("IERC20", WHBAR);

  await ensureAssociated(signer.address, [WHBAR, USDC]);
  const missing = MAX_COST - (await whbar.balanceOf(signer.address));
  if (missing > 0n) {
    const wrapper = await ethers.getContractAt(["function deposit() payable"], SAUCERSWAP_TESTNET.whbarContract);
    await (await wrapper.deposit({ value: missing * TINYBAR_TO_WEIBAR, gasLimit: 300_000 })).wait();
  }
  await (await whbar.approve(await flash.getAddress(), MAX_COST, { gasLimit: 1_000_000 })).wait();

  const tx = await flash.flashArbitrage(WHBAR, LOAN, [WHBAR, SAUCE], [SAUCE, WHBAR], -MAX_COST, {
    gasLimit: 4_000_000,
  });
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map(log => flash.interface.parseLog(log))
    .find(parsed => parsed?.name === "FlashLoanExecuted");
  console.log(
    `Flash loan of ${ethers.formatUnits(LOAN, 8)} WHBAR, fee ${ethers.formatUnits(event?.args.fee ?? 0n, 8)}, PnL ${ethers.formatUnits(event?.args.pnl ?? 0n, 8)} WHBAR`,
  );
  console.log(`https://hashscan.io/testnet/transaction/${tx.hash}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

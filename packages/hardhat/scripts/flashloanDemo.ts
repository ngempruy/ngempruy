import { deployments, ethers, network } from "hardhat";
import { BONZO_TESTNET } from "../utils/bonzo";
import { ensureAssociated } from "../utils/hts";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/**
 * One Bonzo flash loan round-trip on testnet: borrow WHBAR, swap WHBAR → USDC → WHBAR on SaucerSwap,
 * repay amount + premium. A single pool has no arbitrage, so the owner covers the cost (premium + swap
 * fees) up to MAX_COST; on mainnet you would pass a positive minPnl instead.
 * Bonzo testnet reserves are often empty, so the script first supplies LIQUIDITY if needed.
 *
 *   yarn hardhat:deploy --network hederaTestnet --tags flashloan
 *   yarn hardhat:flashloan:demo --network hederaTestnet
 */
const LOAN = 100_000_000n; // 1 WHBAR (8 decimals)
const LIQUIDITY = 200_000_000n; // supplied to Bonzo when its WHBAR reserve holds less than LOAN
const MAX_COST = 5_000_000n; // 0.05 WHBAR
const TINYBAR_TO_WEIBAR = 10_000_000_000n; // JSON-RPC values are weibar (1e18 per HBAR)

async function main() {
  if (network.name !== "hederaTestnet") throw new Error("Run with --network hederaTestnet");
  const [signer] = await ethers.getSigners();
  const { whbar: WHBAR, usdc: USDC } = SAUCERSWAP_TESTNET;
  const flash = await ethers.getContractAt("BonzoFlashLoan", (await deployments.get("BonzoFlashLoan")).address);
  const pool = await ethers.getContractAt(
    [
      "function getReserveData(address) view returns (uint256 configuration, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)",
      "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
    ],
    BONZO_TESTNET.lendingPool,
  );
  const whbar = await ethers.getContractAt("IERC20", WHBAR);

  await ensureAssociated(signer.address, [WHBAR, USDC]);

  const { aTokenAddress } = await pool.getReserveData(WHBAR);
  const reserve = await whbar.balanceOf(aTokenAddress);
  const supply = reserve < LOAN ? LIQUIDITY : 0n;
  console.log(`Bonzo WHBAR reserve: ${ethers.formatUnits(reserve, 8)}${supply ? " → supplying liquidity" : ""}`);

  const needed = supply + MAX_COST - (await whbar.balanceOf(signer.address));
  if (needed > 0n) {
    const wrapper = await ethers.getContractAt(["function deposit() payable"], SAUCERSWAP_TESTNET.whbarContract);
    await (await wrapper.deposit({ value: needed * TINYBAR_TO_WEIBAR, gasLimit: 300_000 })).wait();
  }
  if (supply > 0n) {
    await (await whbar.approve(BONZO_TESTNET.lendingPool, supply, { gasLimit: 1_000_000 })).wait();
    const tx = await pool.deposit(WHBAR, supply, signer.address, 0, { gasLimit: 1_500_000 });
    await tx.wait();
    console.log(`Supplied ${ethers.formatUnits(supply, 8)} WHBAR: https://hashscan.io/testnet/transaction/${tx.hash}`);
  }

  await (await whbar.approve(await flash.getAddress(), MAX_COST, { gasLimit: 1_000_000 })).wait();
  const tx = await flash.flashArbitrage(WHBAR, LOAN, [WHBAR, USDC], [USDC, WHBAR], -MAX_COST, {
    gasLimit: 4_000_000,
  });
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map(log => flash.interface.parseLog(log))
    .find(parsed => parsed?.name === "FlashLoanExecuted");
  console.log(
    `Flash loan of ${ethers.formatUnits(LOAN, 8)} WHBAR, premium ${ethers.formatUnits(event?.args.premium ?? 0n, 8)}, PnL ${ethers.formatUnits(event?.args.pnl ?? 0n, 8)} WHBAR`,
  );
  console.log(`https://hashscan.io/testnet/transaction/${tx.hash}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

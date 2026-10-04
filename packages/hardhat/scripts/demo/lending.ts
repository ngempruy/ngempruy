import { LENDING_TESTNET } from "../../utils/lending";
import type { DemoContext } from "../demo";

const COLLATERAL = 500_000_000n; // 5 WHBAR
const LOAN = 150_000n; // 0.15 USDC, about 30% LTV at $0.10/HBAR
const DEMO_INTERVAL = 30; // seconds, so the scheduled checks run while you watch
const TINYBAR_TO_WEIBAR = 10_000_000_000n;
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

/**
 * A borrower posts WHBAR and borrows USDC; the market schedules its own health check (HIP-1215).
 * The demo waits for the network to run that check (healthy → rescheduled), then lowers the
 * liquidation threshold so the next scheduled check liquidates the position on its own.
 */
export default async function lendingDemo({ hre, send }: DemoContext) {
  const { ethers, deployments } = hre;
  const [owner] = await ethers.getSigners();
  const { whbar, usdc, whbarContract } = LENDING_TESTNET;
  const market = await ethers.getContractAt("LendingMarket", (await deployments.get("LendingMarket")).address);
  const marketAddress = await market.getAddress();
  const kit = { name: "LendingMarket", contract: market };
  const checkScheduled = market.interface.getEvent("CheckScheduled").topicHash;
  const [maxLtv, threshold, interval] = await Promise.all([
    market.maxLtvBps(),
    market.liquidationThresholdBps(),
    market.checkInterval(),
  ]);

  const usdcToken = new ethers.Contract(
    usdc,
    ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"],
    owner,
  );
  if ((await usdcToken.balanceOf(marketAddress)) < LOAN) {
    await send("owner approves USDC liquidity", usdcToken.approve(marketAddress, LOAN, { gasLimit: 1_000_000 }));
    await send("owner supplies 0.15 USDC of liquidity", market.supplyLiquidity(LOAN, { gasLimit: 500_000 }));
  }
  await send(
    `owner shortens the check interval to ${DEMO_INTERVAL}s for the demo`,
    market.setRiskParams(maxLtv, threshold, DEMO_INTERVAL, { gasLimit: 300_000 }),
    kit,
  );

  const borrower = ethers.Wallet.createRandom().connect(ethers.provider);
  await send(
    `fund borrower ${borrower.address} with 11 HBAR`,
    owner.sendTransaction({ to: borrower.address, value: ethers.parseEther("11") }),
  );
  for (const [name, address] of [
    ["WHBAR", whbar],
    ["USDC", usdc],
  ]) {
    const hrc719 = new ethers.Contract(address, ["function associate() returns (uint256)"], borrower);
    await send(`borrower associates ${name} (HIP-719)`, hrc719.associate({ gasLimit: 1_000_000 }));
  }
  const wrapper = new ethers.Contract(whbarContract, ["function deposit() payable"], borrower);
  await send("borrower wraps 5 HBAR", wrapper.deposit({ value: COLLATERAL * TINYBAR_TO_WEIBAR, gasLimit: 300_000 }));
  const whbarToken = new ethers.Contract(whbar, ["function approve(address,uint256) returns (bool)"], borrower);
  await send("borrower approves the market", whbarToken.approve(marketAddress, COLLATERAL, { gasLimit: 1_000_000 }));

  const asBorrower = market.connect(borrower);
  await send("borrower deposits 5 WHBAR of collateral", asBorrower.deposit(COLLATERAL, { gasLimit: 500_000 }), kit);
  await send(
    "borrower borrows 0.15 USDC (schedules a health check)",
    asBorrower.borrow(LOAN, { gasLimit: 3_000_000 }),
    kit,
  );

  const first = (await market.positions(borrower.address)).nextCheck;
  console.log(`    scheduled check at ${new Date(Number(first) * 1000).toISOString()}`);
  await waitFor("the network runs the check and reschedules it", async () => {
    return (await market.positions(borrower.address)).nextCheck > first;
  });
  await printScheduleExecutions(marketAddress, checkScheduled);

  await send(
    "owner lowers the liquidation threshold below the loan's LTV",
    market.setRiskParams(2_000, 2_500, DEMO_INTERVAL, { gasLimit: 300_000 }),
    kit,
  );
  await waitFor("the next scheduled check liquidates the position on its own", async () => {
    return (await market.positions(borrower.address)).debt === 0n;
  });
  await printScheduleExecutions(marketAddress, checkScheduled);
  console.log(`    reserves now hold ${ethers.formatUnits(await market.reserves(), 8)} WHBAR of seized collateral`);

  await send(
    "owner restores the risk parameters",
    market.setRiskParams(maxLtv, threshold, interval, { gasLimit: 300_000 }),
    kit,
  );
}

async function waitFor(label: string, done: () => Promise<boolean>, timeoutMs = 240_000) {
  const start = Date.now();
  while (!(await done())) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }
  console.log(`  ✓ ${label} (${Math.round((Date.now() - start) / 1000)}s)`);
}

/** The market's latest HIP-1215 schedules and when the network executed them (mirror node). */
async function printScheduleExecutions(market: string, topic0: string) {
  const logs = await fetch(`${MIRROR}/contracts/${market}/results/logs?topic0=${topic0}&order=desc&limit=2`);
  if (!logs.ok) return;
  const { logs: entries } = (await logs.json()) as { logs: { data: string }[] };
  for (const { data } of entries) {
    // CheckScheduled(user indexed, expirySecond, schedule): data = expirySecond ‖ schedule
    const scheduleId = `0.0.${BigInt(`0x${data.slice(2 + 64 + 24, 2 + 128)}`)}`;
    const res = await fetch(`${MIRROR}/schedules/${scheduleId}`);
    const schedule = res.ok ? ((await res.json()) as { executed_timestamp: string | null }) : undefined;
    const executed = schedule?.executed_timestamp ? `executed at ${schedule.executed_timestamp}` : "pending";
    console.log(`    schedule ${scheduleId} ${executed}: https://hashscan.io/testnet/schedule/${scheduleId}`);
  }
}

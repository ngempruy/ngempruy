"use client";

import { useState } from "react";
import { type Address, erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { hashscanUrl } from "@sh/shared";
import { Small, Stat } from "~~/components/kit";
import { useDeployedContractInfo, useScaffoldReadContract, useTransactor } from "~~/hooks/scaffold-hbar";
import { recordAudit } from "~~/utils/recordAudit";

const TESTNET_CHAIN_ID = 296;
// Same addresses as packages/hardhat/utils/lending.ts.
const WHBAR = "0x0000000000000000000000000000000000003aD2"; // collateral, 8 decimals
const USDC = "0x0000000000000000000000000000000000001549"; // borrowed, 6 decimals

const pct = (bps: bigint | number) => `${Number(bps) / 100}%`;

export const LendingView = () => {
  const { address: account } = useAccount();
  const { data: market } = useDeployedContractInfo({ contractName: "LendingMarket" });
  const { data: maxLtv } = useScaffoldReadContract({ contractName: "LendingMarket", functionName: "maxLtvBps" });
  const { data: threshold } = useScaffoldReadContract({
    contractName: "LendingMarket",
    functionName: "liquidationThresholdBps",
  });
  const { data: interval } = useScaffoldReadContract({ contractName: "LendingMarket", functionName: "checkInterval" });
  const { data: price } = useScaffoldReadContract({
    contractName: "ChainlinkOracleAdapter",
    functionName: "getPrice",
    args: [WHBAR],
  });
  const { data: position, refetch: refetchPosition } = useScaffoldReadContract({
    contractName: "LendingMarket",
    functionName: "positions",
    args: [account],
  });
  const { data: ltv, refetch: refetchLtv } = useScaffoldReadContract({
    contractName: "LendingMarket",
    functionName: "ltvBps",
    args: [account],
  });
  const { data: liquidity } = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [market?.address as Address],
    query: { enabled: !!market },
  });

  const [collateralIn, setCollateralIn] = useState("5");
  const [usdcIn, setUsdcIn] = useState("0.1");
  const [status, setStatus] = useState<string>();
  const { writeContractAsync } = useWriteContract();
  const transactor = useTransactor();

  if (!market) return <p className="m-0 text-sm">LendingMarket is not deployed yet.</p>;

  const [collateral, debt, nextCheck] = position ?? [0n, 0n, 0n];
  const approve = (token: Address, amount: bigint) =>
    transactor(() =>
      writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [market.address, amount] }),
    );
  const run = async (functionName: "deposit" | "withdraw" | "borrow" | "repay", amount: bigint) => {
    const hash = await transactor(() =>
      writeContractAsync({ address: market.address, abi: market.abi, functionName, args: [amount] }),
    );
    if (hash) setStatus(await recordAudit(hash));
    await Promise.all([refetchPosition(), refetchLtv()]);
  };
  const whbarAmount = parseUnits(collateralIn || "0", 8);
  const usdcAmount = parseUnits(usdcIn || "0", 6);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Collateral price (Chainlink)">
          {price ? `$${Number(formatUnits(price[0], 18)).toFixed(4)} / HBAR` : "—"}
          <Small>
            <a className="link" target="_blank" href={hashscanUrl(TESTNET_CHAIN_ID, "contract", market.address)}>
              market
            </a>{" "}
            · liquidity {liquidity !== undefined ? formatUnits(liquidity, 6) : "—"} USDC
          </Small>
        </Stat>
        <Stat label="Risk">
          max LTV {maxLtv !== undefined ? pct(maxLtv) : "—"} · liquidation{" "}
          {threshold !== undefined ? pct(threshold) : "—"}
          <Small>HIP-1215 health check every {interval !== undefined ? `${interval}s` : "—"}</Small>
        </Stat>
        <Stat label="Your position">
          {account ? `${formatUnits(collateral, 8)} WHBAR · ${formatUnits(debt, 6)} USDC debt` : "connect a wallet"}
          {account && debt > 0n && (
            <Small>
              LTV {ltv !== undefined ? pct(ltv) : "—"} · next scheduled check{" "}
              {nextCheck > 0n ? new Date(Number(nextCheck) * 1000).toLocaleTimeString() : "none"}
            </Small>
          )}
        </Stat>
      </section>

      {status && <p className="alert m-0 text-sm">{status}</p>}

      {account && (
        <section className="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
          <p className="text-base-content/70 m-0 text-sm">
            Borrowing schedules a health check on the network itself (Schedule Service <code>0x16b</code>). If your LTV
            is above the liquidation threshold when it runs, your collateral is seized. Associate WHBAR and USDC and
            wrap HBAR on the DEX page first.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input input-sm input-bordered w-24"
              inputMode="decimal"
              value={collateralIn}
              onChange={e => setCollateralIn(e.target.value)}
              aria-label="WHBAR amount"
            />
            <span className="text-sm">WHBAR</span>
            <button
              className="btn btn-sm"
              disabled={whbarAmount === 0n}
              onClick={async () => {
                await approve(WHBAR, whbarAmount);
                await run("deposit", whbarAmount);
              }}
            >
              Deposit
            </button>
            <button className="btn btn-sm" disabled={whbarAmount === 0n} onClick={() => run("withdraw", whbarAmount)}>
              Withdraw
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input input-sm input-bordered w-24"
              inputMode="decimal"
              value={usdcIn}
              onChange={e => setUsdcIn(e.target.value)}
              aria-label="USDC amount"
            />
            <span className="text-sm">USDC</span>
            <button
              className="btn btn-sm btn-primary"
              disabled={usdcAmount === 0n}
              onClick={() => run("borrow", usdcAmount)}
            >
              Borrow
            </button>
            <button
              className="btn btn-sm"
              disabled={usdcAmount === 0n}
              onClick={async () => {
                await approve(USDC, usdcAmount);
                await run("repay", usdcAmount);
              }}
            >
              Repay
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

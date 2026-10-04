"use client";

import { useState } from "react";
import { type Address, erc20Abi, formatUnits, parseEther, parseUnits } from "viem";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { hashscanUrl } from "@sh/shared";
import { Panel, Stat } from "~~/components/kit";
import { useDeployedContractInfo, useScaffoldReadContract, useTransactor } from "~~/hooks/scaffold-hbar";
import { recordAudit } from "~~/utils/recordAudit";

const TESTNET_CHAIN_ID = 296;
// Same addresses as packages/hardhat/utils/saucerswap.ts (verified on testnet 2026-10-03).
const WHBAR_CONTRACT = "0x0000000000000000000000000000000000003aD1"; // 0.0.15057: deposit() wraps HBAR
const WHBAR = { address: "0x0000000000000000000000000000000000003aD2", symbol: "WHBAR", decimals: 8 } as const;
const USDC = { address: "0x0000000000000000000000000000000000001549", symbol: "USDC", decimals: 6 } as const;
const PATH = [WHBAR.address, USDC.address] as const;
const SLIPPAGE_BPS = 100n;

const hrc719Abi = [
  { type: "function", name: "associate", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
] as const;
const whbarAbi = [{ type: "function", name: "deposit", inputs: [], outputs: [], stateMutability: "payable" }] as const;

export const DexView = () => {
  const { address: account } = useAccount();
  const { data: adapter } = useDeployedContractInfo({ contractName: "SaucerSwapAdapter" });
  const [amount, setAmount] = useState("1");
  const [status, setStatus] = useState<string>();
  const { writeContractAsync } = useWriteContract();
  const transactor = useTransactor();

  const amountIn = parseUnits(amount || "0", WHBAR.decimals);
  const { data: quote } = useScaffoldReadContract({
    contractName: "SaucerSwapAdapter",
    functionName: "quote",
    args: [amountIn, [...PATH]],
    query: { enabled: amountIn > 0n },
  });
  const minOut = quote === undefined ? undefined : (quote * (10_000n - SLIPPAGE_BPS)) / 10_000n;

  const { data: balances, refetch } = useReadContracts({
    contracts: [WHBAR, USDC].map(t => ({
      address: t.address as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account as Address],
    })),
    query: { enabled: !!account },
  });

  const send = (tx: Parameters<typeof writeContractAsync>[0]) => transactor(() => writeContractAsync(tx));

  const swap = async () => {
    if (!adapter || minOut === undefined) return;
    await send({ address: WHBAR.address, abi: erc20Abi, functionName: "approve", args: [adapter.address, amountIn] });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    const hash = await send({
      address: adapter.address,
      abi: adapter.abi,
      functionName: "swap",
      args: [amountIn, minOut, [...PATH], account as Address, deadline],
    });
    if (hash) setStatus(await recordAudit(hash));
    await refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Adapter">
          {adapter ? (
            <a className="link" target="_blank" href={hashscanUrl(TESTNET_CHAIN_ID, "contract", adapter.address)}>
              SaucerSwap V1
            </a>
          ) : (
            "not deployed"
          )}
        </Stat>
        <Stat label={`Quote for ${amount || 0} WHBAR`}>
          {quote !== undefined ? `${formatUnits(quote, USDC.decimals)} USDC` : "—"}
        </Stat>
        <Stat label="Your balance">
          {account && balances
            ? [WHBAR, USDC]
                .map((t, i) => `${formatUnits((balances[i]?.result as bigint) ?? 0n, t.decimals)} ${t.symbol}`)
                .join(" · ")
            : "connect a wallet"}
        </Stat>
      </section>

      {status && <p className="alert m-0 text-sm">{status}</p>}

      {account && adapter && (
        <Panel
          title="Swap HBAR → USDC"
          hint={
            <>
              HTS tokens need an association before you can hold them, and the router trades WHBAR, not native HBAR.
              Minimum received: {minOut !== undefined ? formatUnits(minOut, USDC.decimals) : "—"} USDC (1% slippage).
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input input-sm input-bordered w-32"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <span className="text-sm">HBAR</span>
            <button
              className="btn btn-sm"
              onClick={async () => {
                for (const t of [WHBAR, USDC])
                  await send({ address: t.address, abi: hrc719Abi, functionName: "associate" });
              }}
            >
              1. Associate WHBAR + USDC
            </button>
            <button
              className="btn btn-sm"
              disabled={amountIn === 0n}
              onClick={async () => {
                await transactor(() =>
                  writeContractAsync({
                    address: WHBAR_CONTRACT,
                    abi: whbarAbi,
                    functionName: "deposit",
                    value: parseEther(amount),
                  }),
                );
                await refetch();
              }}
            >
              2. Wrap HBAR
            </button>
            <button className="btn btn-sm btn-primary" disabled={minOut === undefined} onClick={swap}>
              3. Swap
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
};

"use client";

import { useState } from "react";
import { type Address, erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { hashscanUrl } from "@sh/shared";
import { useDeployedContractInfo, useScaffoldReadContract, useTransactor } from "~~/hooks/scaffold-hbar";
import { recordAudit } from "~~/utils/recordAudit";

const TESTNET_CHAIN_ID = 296;
// Same addresses as packages/hardhat/utils/saucerswap.ts (verified on testnet 2026-10-03).
const WHBAR = "0x0000000000000000000000000000000000003aD2"; // 8 decimals
const SAUCE = "0x0000000000000000000000000000000000120f46";
const DECIMALS = 8;

export const FlashLoanView = () => {
  const { address: account } = useAccount();
  const { data: flash } = useDeployedContractInfo({ contractName: "SaucerSwapFlashLoan" });
  const { data: bonzo } = useDeployedContractInfo({ contractName: "BonzoFlashLoan" });
  const { data: owner } = useScaffoldReadContract({ contractName: "SaucerSwapFlashLoan", functionName: "owner" });
  const { data: pair } = useScaffoldReadContract({
    contractName: "SaucerSwapFlashLoan",
    functionName: "flashPairs",
    args: [WHBAR],
  });
  const [amount, setAmount] = useState("1");
  const [maxCost, setMaxCost] = useState("0.05");
  const [status, setStatus] = useState<string>();
  const { writeContractAsync } = useWriteContract();
  const transactor = useTransactor();

  // Estimate the round trip WHBAR → SAUCE → WHBAR with the adapter's quotes.
  const loan = parseUnits(amount || "0", DECIMALS);
  const { data: sauceOut } = useScaffoldReadContract({
    contractName: "SaucerSwapAdapter",
    functionName: "quote",
    args: [loan, [WHBAR, SAUCE]],
    query: { enabled: loan > 0n },
  });
  const { data: whbarBack } = useScaffoldReadContract({
    contractName: "SaucerSwapAdapter",
    functionName: "quote",
    args: [sauceOut ?? 0n, [SAUCE, WHBAR]],
    query: { enabled: !!sauceOut },
  });
  const fee = (loan * 1000n) / 997n + 1n - loan; // SaucerSwap V1 flash swap fee (0.3%)
  const estimatedPnl = whbarBack === undefined ? undefined : whbarBack - loan - fee;
  const isOwner = !!account && account.toLowerCase() === owner?.toLowerCase();

  const run = async () => {
    if (!flash) return;
    const cost = parseUnits(maxCost || "0", DECIMALS);
    await transactor(() =>
      writeContractAsync({ address: WHBAR, abi: erc20Abi, functionName: "approve", args: [flash.address, cost] }),
    );
    const hash = await transactor(() =>
      writeContractAsync({
        address: flash.address,
        abi: flash.abi,
        functionName: "flashArbitrage",
        args: [WHBAR, loan, [WHBAR, SAUCE], [SAUCE, WHBAR], -cost],
      }),
    );
    if (hash) setStatus(await recordAudit(hash));
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="SaucerSwap flash swaps">
          {flash ? <ContractLink address={flash.address}>live</ContractLink> : "not deployed"}
          {pair && <span className="text-base-content/60 block text-xs">WHBAR borrowed from the WHBAR/USDC pair</span>}
        </Stat>
        <Stat label="Bonzo Lend flash loans">
          {bonzo ? <ContractLink address={bonzo.address}>deployed</ContractLink> : "not deployed"}
          <span className="text-base-content/60 block text-xs">
            Waiting on Bonzo: mainnet pool paused, testnet deposits revert
          </span>
        </Stat>
        <Stat label={`Estimated PnL for ${amount || 0} WHBAR`}>
          {estimatedPnl !== undefined ? `${formatUnits(estimatedPnl, DECIMALS)} WHBAR` : "—"}
          <span className="text-base-content/60 block text-xs">0.3% flash fee + two swaps via WHBAR/SAUCE</span>
        </Stat>
      </section>

      {status && <p className="alert m-0 text-sm">{status}</p>}

      {flash && (
        <section className="bg-base-100 border-base-300 flex flex-col gap-3 rounded-2xl border p-5">
          <div>
            <h3 className="m-0 font-bold">Arbitrage WHBAR → SAUCE → WHBAR</h3>
            <p className="text-base-content/70 m-0 text-sm">
              Borrows WHBAR, trades through a different pair than the one it borrowed from (the source pair is locked
              during the loan) and repays in the same transaction. Without a price gap the round trip costs the fees, so
              the owner caps what they pay with Max cost; the whole transaction reverts above it.
            </p>
          </div>
          {isOwner ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">Loan</label>
              <input
                className="input input-sm input-bordered w-28"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <label className="text-sm">Max cost</label>
              <input
                className="input input-sm input-bordered w-28"
                inputMode="decimal"
                value={maxCost}
                onChange={e => setMaxCost(e.target.value)}
              />
              <span className="text-sm">WHBAR</span>
              <button className="btn btn-sm btn-primary" disabled={loan === 0n} onClick={run}>
                Run flash loan
              </button>
            </div>
          ) : (
            <p className="m-0 text-sm">
              Only the contract owner can start a loan
              {owner && (
                <>
                  {" "}
                  (<ContractLink address={owner as Address}>{`${owner.slice(0, 6)}…${owner.slice(-4)}`}</ContractLink>)
                </>
              )}
              . Deploy your own with <code>yarn hardhat:deploy --tags flashloan</code>.
            </p>
          )}
        </section>
      )}
    </div>
  );
};

const ContractLink = ({ address, children }: { address: Address; children: React.ReactNode }) => (
  <a className="link" target="_blank" href={hashscanUrl(TESTNET_CHAIN_ID, "contract", address)}>
    {children}
  </a>
);

const Stat = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="bg-base-100 border-base-300 rounded-2xl border p-5">
    <p className="text-base-content/60 m-0 text-xs uppercase tracking-wider">{label}</p>
    <div className="mt-1 font-semibold">{children}</div>
  </div>
);

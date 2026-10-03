"use client";

import { useState } from "react";
import { type Address, erc20Abi, formatUnits, keccak256, parseUnits, toBytes } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useTransactor } from "~~/hooks/scaffold-hbar";
import { accountIdToAddress } from "~~/modules/payments/DirectTransfer";
import { recordAudit } from "~~/utils/recordAudit";

// Same addresses as packages/hardhat/utils/saucerswap.ts (verified on testnet 2026-10-03).
const USDC = { symbol: "USDC", address: "0x0000000000000000000000000000000000001549", decimals: 6 } as const;
const WHBAR = "0x0000000000000000000000000000000000003aD2";
const TOKENS = [
  { symbol: "WHBAR", address: WHBAR, decimals: 8, path: [WHBAR, USDC.address] },
  {
    symbol: "SAUCE",
    address: "0x0000000000000000000000000000000000120f46",
    decimals: 6,
    path: ["0x0000000000000000000000000000000000120f46", WHBAR, USDC.address],
  },
  { ...USDC, path: [USDC.address] },
] as const;
const BUFFER_PCT = 103n; // pay 3% over the quote; SwapCheckout refunds the surplus in USDC

const hrc719Abi = [
  { type: "function", name: "associate", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
] as const;

export const CheckoutForm = ({ merchant }: { merchant: string }) => {
  const { address: account } = useAccount();
  const { data: checkout } = useDeployedContractInfo({ contractName: "SwapCheckout" });
  const [orderId, setOrderId] = useState("order-1");
  const [price, setPrice] = useState("0.5");
  const [tokenIndex, setTokenIndex] = useState(0);
  const [status, setStatus] = useState<string>();
  const { writeContractAsync } = useWriteContract();
  const transactor = useTransactor();

  const token = TOKENS[tokenIndex];
  const priceUnits = parseUnits(price || "0", USDC.decimals);
  const oneToken = 10n ** BigInt(token.decimals);
  const swaps = token.path.length > 1;
  const { data: usdcPerToken } = useScaffoldReadContract({
    contractName: "SaucerSwapAdapter",
    functionName: "quote",
    args: [oneToken, [...token.path]],
    query: { enabled: swaps },
  });
  const amountIn = !swaps
    ? priceUnits
    : usdcPerToken
      ? (priceUnits * oneToken * BUFFER_PCT) / (usdcPerToken * 100n)
      : undefined;

  const pay = async () => {
    if (!checkout || amountIn === undefined) return;
    await transactor(() =>
      writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [checkout.address, amountIn],
      }),
    );
    const hash = await transactor(() =>
      writeContractAsync({
        address: checkout.address,
        abi: checkout.abi,
        functionName: "pay",
        args: [
          keccak256(toBytes(orderId)),
          accountIdToAddress(merchant),
          priceUnits,
          [...token.path],
          amountIn,
          BigInt(Math.floor(Date.now() / 1000) + 600),
        ],
      }),
    );
    if (hash) setStatus(await recordAudit(hash));
  };

  if (!checkout) return <p className="m-0 text-sm">SwapCheckout is not deployed yet.</p>;

  return (
    <section className="bg-base-100 border-base-300 flex flex-col gap-3 rounded-2xl border p-5">
      <p className="text-base-content/70 m-0 text-sm">
        Merchant {merchant} receives exactly the price in USDC; the token you pay with is swapped on SaucerSwap and any
        surplus comes back to you as USDC, so associate USDC first. Wrap HBAR into WHBAR on the DEX page.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input input-sm input-bordered w-32"
          value={orderId}
          onChange={e => setOrderId(e.target.value)}
          aria-label="Order id"
        />
        <input
          className="input input-sm input-bordered w-24"
          inputMode="decimal"
          value={price}
          onChange={e => setPrice(e.target.value)}
          aria-label="Price in USDC"
        />
        <span className="text-sm">USDC, pay with</span>
        <select
          className="select select-sm select-bordered"
          value={tokenIndex}
          onChange={e => setTokenIndex(Number(e.target.value))}
        >
          {TOKENS.map((t, i) => (
            <option key={t.symbol} value={i}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
      <p className="m-0 text-sm">
        You send {amountIn !== undefined ? formatUnits(amountIn, token.decimals) : "—"} {token.symbol}
        {swaps && " (3% buffer, refunded in USDC)"}
      </p>
      {account ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-sm"
            onClick={() =>
              transactor(() => writeContractAsync({ address: USDC.address, abi: hrc719Abi, functionName: "associate" }))
            }
          >
            Associate USDC
          </button>
          <button className="btn btn-sm btn-primary" disabled={!amountIn || priceUnits === 0n} onClick={pay}>
            Pay {orderId}
          </button>
        </div>
      ) : (
        <p className="m-0 text-sm">Connect a wallet to pay.</p>
      )}
      {status && <p className="alert m-0 text-sm">{status}</p>}
    </section>
  );
};

"use client";

import { useState } from "react";
import { type Address, isAddress, parseEther } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import { useTransactor } from "~~/hooks/scaffold-hbar";

/** Hedera account 0.0.N as its long-zero EVM address. */
const accountIdToAddress = (id: string) => `0x${BigInt(id.split(".")[2]).toString(16).padStart(40, "0")}` as Address;

/** Pays HBAR straight from the connected EVM wallet (no facilitator, payer covers the fee). */
export const DirectTransfer = ({ payTo }: { payTo: string }) => {
  const { address } = useAccount();
  const [to, setTo] = useState(accountIdToAddress(payTo));
  const [amount, setAmount] = useState("1");
  const { sendTransactionAsync } = useSendTransaction();
  const transactor = useTransactor();

  return (
    <section className="border-base-300 bg-base-100 flex flex-col gap-3 rounded-2xl border p-5">
      <div>
        <h3 className="m-0 font-bold">Direct HBAR transfer</h3>
        <p className="text-base-content/70 m-0 text-sm">
          Defaults to the merchant ({payTo}). JSON-RPC values are in weibars: 1 HBAR = 10^18.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="input input-sm input-bordered grow font-mono"
          value={to}
          onChange={e => setTo(e.target.value.trim() as Address)}
        />
        <input
          className="input input-sm input-bordered w-28"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <button
          className="btn btn-sm btn-primary"
          disabled={!address || !isAddress(to) || !(Number(amount) > 0)}
          onClick={() => transactor(() => sendTransactionAsync({ to, value: parseEther(amount) }))}
        >
          {address ? "Send HBAR" : "Connect a wallet"}
        </button>
      </div>
    </section>
  );
};

"use client";

import { useState } from "react";
import { type Address, erc20Abi, formatUnits, isAddress, keccak256, parseUnits, toBytes } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { hashscanUrl } from "@sh/shared";
import { Panel, Stat } from "~~/components/kit";
import { useScaffoldReadContract, useScaffoldWriteContract, useTransactor } from "~~/hooks/scaffold-hbar";
import { recordAudit } from "~~/utils/recordAudit";

const TESTNET_CHAIN_ID = 296;
const TOKEN_DECIMALS = 6;
const ZERO = "0x0000000000000000000000000000000000000000";
const ISSUER_ROLE = keccak256(toBytes("ISSUER_ROLE"));
const COMPLIANCE_ROLE = keccak256(toBytes("COMPLIANCE_ROLE"));
const APPRAISER_ROLE = keccak256(toBytes("APPRAISER_ROLE"));
/** HIP-719: an account associates itself by calling associate() on the token address. */
const hrc719Abi = [
  { type: "function", name: "associate", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
] as const;

/** HTS token addresses are "long-zero": the address is the entity number. */
const tokenIdOf = (address: string) => `0.0.${BigInt(address)}`;

export const RwaView = () => {
  const { address: account } = useAccount();
  const [status, setStatus] = useState<string>();

  const { data: token } = useScaffoldReadContract({ contractName: "RwaToken", functionName: "token" });
  const { data: nav, refetch: refetchNav } = useScaffoldReadContract({
    contractName: "RwaNavOracle",
    functionName: "nav",
  });
  const { data: updatedAt } = useScaffoldReadContract({ contractName: "RwaNavOracle", functionName: "updatedAt" });
  const { data: isIssuer } = useScaffoldReadContract({
    contractName: "RwaToken",
    functionName: "hasRole",
    args: [ISSUER_ROLE, account],
  });
  const { data: isCompliance } = useScaffoldReadContract({
    contractName: "RwaToken",
    functionName: "hasRole",
    args: [COMPLIANCE_ROLE, account],
  });
  const { data: isAppraiser } = useScaffoldReadContract({
    contractName: "RwaNavOracle",
    functionName: "hasRole",
    args: [APPRAISER_ROLE, account],
  });

  const hasToken = !!token && token !== ZERO;
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: token as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account as Address],
    query: { enabled: hasToken && !!account },
  });

  const { writeContractAsync: writeRwa } = useScaffoldWriteContract({ contractName: "RwaToken" });
  const { writeContractAsync: writeOracle } = useScaffoldWriteContract({ contractName: "RwaNavOracle" });
  const { writeContractAsync } = useWriteContract();
  const transactor = useTransactor();

  /** Runs a kit transaction, then records its events in the HCS audit log. */
  const run = async (send: () => Promise<`0x${string}` | undefined>) => {
    const hash = await send();
    if (!hash) return;
    setStatus(await recordAudit(hash));
    await Promise.all([refetchNav(), refetchBalance()]);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Token">
          {hasToken ? (
            <a className="link" target="_blank" href={hashscanUrl(TESTNET_CHAIN_ID, "token", tokenIdOf(token))}>
              {tokenIdOf(token)}
            </a>
          ) : (
            "not created yet"
          )}
        </Stat>
        <Stat label="NAV per unit">
          {nav ? `$${Number(formatUnits(nav, 18)).toLocaleString()}` : "no NAV posted"}
          {!!updatedAt && (
            <span className="text-base-content/60 block text-xs">
              {new Date(Number(updatedAt) * 1000).toISOString()}
            </span>
          )}
        </Stat>
        <Stat label="Your balance">
          {account && balance !== undefined ? formatUnits(balance, TOKEN_DECIMALS) : "connect a wallet"}
        </Stat>
      </section>

      {status && <p className="alert m-0 text-sm">{status}</p>}

      {account && hasToken && (
        <Panel title="Investor" hint="Associate once before receiving units; compliance must also grant you KYC.">
          <button
            className="btn btn-sm btn-primary self-start"
            onClick={() =>
              transactor(() =>
                writeContractAsync({ address: token as Address, abi: hrc719Abi, functionName: "associate" }),
              )
            }
          >
            Associate {tokenIdOf(token)}
          </button>
        </Panel>
      )}

      {isCompliance && hasToken && (
        <AddressAction
          title="Compliance"
          hint="KYC is enforced by HTS itself: transfers to accounts without KYC fail at the network level."
          actions={{
            "Grant KYC": a => run(() => writeRwa({ functionName: "grantKyc", args: [a] })),
            "Revoke KYC": a => run(() => writeRwa({ functionName: "revokeKyc", args: [a] })),
          }}
        />
      )}

      {isIssuer && hasToken && (
        <AddressAction
          title="Issuer"
          hint="Mints new units to the treasury and transfers them to a KYC'd, associated investor."
          amountLabel="Units"
          actions={{
            Issue: (a, units) =>
              run(() => writeRwa({ functionName: "issue", args: [a, parseUnits(units || "0", TOKEN_DECIMALS)] })),
          }}
        />
      )}

      {isAppraiser && (
        <PostNav
          onPost={(usd, uri) => run(() => writeOracle({ functionName: "postNav", args: [parseUnits(usd, 18), uri] }))}
        />
      )}
    </div>
  );
};

const AddressAction = ({
  title,
  hint,
  amountLabel,
  actions,
}: {
  title: string;
  hint: string;
  amountLabel?: string;
  actions: Record<string, (account: Address, amount: string) => Promise<void>>;
}) => {
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const valid = isAddress(target);
  return (
    <Panel title={title} hint={hint}>
      <div className="flex flex-wrap gap-2">
        <input
          className="input input-sm input-bordered grow"
          placeholder="Investor EVM address (0x…)"
          value={target}
          onChange={e => setTarget(e.target.value.trim())}
        />
        {amountLabel && (
          <input
            className="input input-sm input-bordered w-32"
            placeholder={amountLabel}
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        )}
        {Object.entries(actions).map(([label, action]) => (
          <button
            key={label}
            className="btn btn-sm btn-primary"
            disabled={!valid}
            onClick={() => action(target as Address, amount)}
          >
            {label}
          </button>
        ))}
      </div>
    </Panel>
  );
};

const PostNav = ({ onPost }: { onPost: (usd: string, uri: string) => Promise<void> }) => {
  const [usd, setUsd] = useState("");
  const [uri, setUri] = useState("");
  return (
    <Panel title="Appraiser" hint="Posts NAV per unit in USD. Moves above the deviation limit are rejected on-chain.">
      <div className="flex flex-wrap gap-2">
        <input
          className="input input-sm input-bordered w-32"
          placeholder="USD"
          inputMode="decimal"
          value={usd}
          onChange={e => setUsd(e.target.value)}
        />
        <input
          className="input input-sm input-bordered grow"
          placeholder="Report URI (ipfs://…)"
          value={uri}
          onChange={e => setUri(e.target.value)}
        />
        <button className="btn btn-sm btn-primary" disabled={!(Number(usd) > 0)} onClick={() => onPost(usd, uri)}>
          Post NAV
        </button>
      </div>
    </Panel>
  );
};

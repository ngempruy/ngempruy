"use client";

import { useState } from "react";
import type { Address as AddressType, Chain } from "viem";
import { getAddress } from "viem";
import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-hbar";
import { useHederaAccountId } from "~~/hooks/scaffold-hbar";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-hbar";

type HederaAddressProps = {
  address?: AddressType;
  chain: Chain;
  format?: "short" | "long";
  disableAddressLink?: boolean;
};

export const HederaAddress = ({ address, chain, format, disableAddressLink }: HederaAddressProps) => {
  const [copied, setCopied] = useState(false);
  const { accountId, isLoading } = useHederaAccountId(address, chain.id);

  if (!address) {
    return (
      <div className="flex animate-pulse items-center gap-2">
        <div className="bg-base-300 h-6 w-6 rounded-full" />
        <div className="bg-base-300 h-4 w-32 rounded" />
      </div>
    );
  }

  const checkSumAddress = getAddress(address);
  const shortAddress = `${checkSumAddress.slice(0, 6)}...${checkSumAddress.slice(-4)}`;
  const displayAddress = format === "long" ? checkSumAddress : shortAddress;
  const explorerLink = getBlockExplorerAddressLink(chain, checkSumAddress);

  const handleCopy = () => {
    navigator.clipboard.writeText(checkSumAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };

  const addressContent = <span className="text-sm font-normal">{displayAddress}</span>;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <BlockieAvatar address={checkSumAddress} size={24} ensImage={null} />
        {disableAddressLink ? (
          addressContent
        ) : (
          <a href={explorerLink} target="_blank" rel="noreferrer" className="link no-underline hover:underline">
            {addressContent}
          </a>
        )}
        <button type="button" className="btn btn-ghost btn-xs h-auto min-h-0 p-0" onClick={handleCopy}>
          {copied ? (
            <CheckCircleIcon className="text-success h-4 w-4" />
          ) : (
            <DocumentDuplicateIcon className="h-4 w-4 opacity-70 hover:opacity-100" />
          )}
        </button>
      </div>
      {isLoading ? (
        <span className="text-base-content/60 animate-pulse text-xs">Resolving Hedera Account ID…</span>
      ) : accountId ? (
        <span className="text-base-content/80 text-xs">Hedera Account ID: {accountId}</span>
      ) : null}
    </div>
  );
};

"use client";

// @refresh reset
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Balance } from "@scaffold-hbar-ui/components";
import { Address } from "viem";
import { useNetworkColor } from "~~/hooks/scaffold-hbar";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-hbar";
import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { RevealBurnerPKModal } from "./RevealBurnerPKModal";
import { SetBurnerPKModal } from "./SetBurnerPKModal";
import { WrongNetworkDropdown } from "./WrongNetworkDropdown";

/**
 * Custom Wagmi Connect Button (watch balance + custom design)
 */
export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const blockExplorerAddressLink = account
          ? getBlockExplorerAddressLink(targetNetwork, account.address)
          : undefined;

        return (
          <>
            {(() => {
              if (!connected) {
                return (
                  <button className="btn btn-primary btn-sm" onClick={openConnectModal} type="button">
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported || chain.id !== targetNetwork.id) {
                return <WrongNetworkDropdown />;
              }

              return (
                <>
                  {/* One line, hidden on small screens, so it never overlaps the nav or the address button */}
                  <div className="border-base-content/10 hidden items-center gap-2 whitespace-nowrap rounded-full border py-0.5 pl-3 pr-1 text-xs md:flex">
                    <span className="flex items-center gap-1.5" style={{ color: networkColor }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: networkColor }} />
                      {chain.name}
                    </span>
                    <Balance
                      address={account.address as Address}
                      style={{ minHeight: "0", height: "auto", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    />
                  </div>
                  <AddressInfoDropdown
                    address={account.address as Address}
                    displayName={account.displayName}
                    ensAvatar={account.ensAvatar}
                    blockExplorerAddressLink={blockExplorerAddressLink}
                  />
                  <RevealBurnerPKModal />
                  <SetBurnerPKModal />
                </>
              );
            })()}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
};

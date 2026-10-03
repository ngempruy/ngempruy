import { useRef, useState } from "react";
import { getAddress } from "viem";
import { Address } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import {
  ArrowLeftStartOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-hbar";
import { useCopyToClipboard, useOutsideClick } from "~~/hooks/scaffold-hbar";
import { getTargetNetworks } from "~~/utils/scaffold-hbar";
import { isENS } from "~~/utils/scaffold-hbar/common";
import { NetworkOptions } from "./NetworkOptions";

const allowedNetworks = getTargetNetworks();

type AddressInfoDropdownProps = {
  address: Address;
  blockExplorerAddressLink: string | undefined;
  displayName: string;
  ensAvatar?: string;
};

const BURNER_WALLET_CONNECTOR_ID = "burnerWallet";

export const AddressInfoDropdown = ({
  address,
  ensAvatar,
  displayName,
  blockExplorerAddressLink,
}: AddressInfoDropdownProps) => {
  const { disconnect } = useDisconnect();
  const { connector } = useAccount();
  const isBurnerWallet = connector?.id === BURNER_WALLET_CONNECTOR_ID;
  const checkSumAddress = getAddress(address);

  const { copyToClipboard: copyAddressToClipboard, isCopiedToClipboard: isAddressCopiedToClipboard } =
    useCopyToClipboard();
  const [selectingNetwork, setSelectingNetwork] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  const closeDropdown = () => {
    setSelectingNetwork(false);
    dropdownRef.current?.removeAttribute("open");
  };

  useOutsideClick(dropdownRef, closeDropdown);

  return (
    <>
      <details ref={dropdownRef} className="dropdown dropdown-end leading-3">
        <summary className="btn btn-secondary btn-sm dropdown-toggle h-auto! gap-0 pl-0 pr-2 shadow-md">
          <BlockieAvatar address={checkSumAddress} size={30} ensImage={ensAvatar} />
          <span className="ml-2 mr-1">
            {isENS(displayName) ? displayName : checkSumAddress?.slice(0, 6) + "..." + checkSumAddress?.slice(-4)}
          </span>
          <ChevronDownIcon className="ml-2 h-6 w-4 sm:ml-0" />
        </summary>
        <ul className="dropdown-content menu z-2 shadow-center shadow-accent bg-base-200 rounded-box mt-2 gap-1 p-2">
          <NetworkOptions hidden={!selectingNetwork} />
          <li className={selectingNetwork ? "hidden" : ""}>
            <div
              className="btn-sm rounded-xl! flex h-8 cursor-pointer gap-3 py-3"
              onClick={() => copyAddressToClipboard(checkSumAddress)}
            >
              {isAddressCopiedToClipboard ? (
                <>
                  <CheckCircleIcon className="ml-2 h-6 w-4 text-xl font-normal sm:ml-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Copied!</span>
                </>
              ) : (
                <>
                  <DocumentDuplicateIcon className="ml-2 h-6 w-4 text-xl font-normal sm:ml-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Copy address</span>
                </>
              )}
            </div>
          </li>
          <li className={selectingNetwork ? "hidden" : ""}>
            <button className="btn-sm rounded-xl! flex h-8 gap-3 py-3" type="button">
              <ArrowTopRightOnSquareIcon className="ml-2 h-6 w-4 sm:ml-0" />
              <a
                target="_blank"
                href={blockExplorerAddressLink}
                rel="noopener noreferrer"
                className="whitespace-nowrap"
              >
                View on Block Explorer
              </a>
            </button>
          </li>
          {allowedNetworks.length > 1 ? (
            <li className={selectingNetwork ? "hidden" : ""}>
              <button
                className="btn-sm rounded-xl! flex h-8 gap-3 py-3"
                type="button"
                onClick={() => {
                  setSelectingNetwork(true);
                }}
              >
                <ArrowsRightLeftIcon className="ml-2 h-6 w-4 sm:ml-0" /> <span>Switch Network</span>
              </button>
            </li>
          ) : null}
          {isBurnerWallet && (
            <>
              <li className={selectingNetwork ? "hidden" : ""}>
                <label htmlFor="reveal-burner-pk-modal" className="btn-sm rounded-xl! flex h-8 gap-3 py-3">
                  <KeyIcon className="ml-2 h-6 w-4 sm:ml-0" />
                  <span className="whitespace-nowrap">Reveal Private Key</span>
                </label>
              </li>
              <li className={selectingNetwork ? "hidden" : ""}>
                <label htmlFor="set-burner-pk-modal" className="btn-sm rounded-xl! flex h-8 gap-3 py-3">
                  <KeyIcon className="ml-2 h-6 w-4 sm:ml-0" />
                  <span className="whitespace-nowrap">Set Private Key</span>
                </label>
              </li>
            </>
          )}
          <li className={selectingNetwork ? "hidden" : ""}>
            <button
              className="menu-item text-error btn-sm rounded-xl! flex h-8 gap-3 py-3"
              type="button"
              onClick={() => disconnect()}
            >
              <ArrowLeftStartOnRectangleIcon className="ml-2 h-6 w-4 sm:ml-0" /> <span>Disconnect</span>
            </button>
          </li>
        </ul>
      </details>
    </>
  );
};

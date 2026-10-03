import { useRef } from "react";
import { rainbowkitBurnerWallet } from "burner-connector";
import {
  CheckIcon,
  ClipboardDocumentIcon,
  KeyIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCopyToClipboard } from "~~/hooks/scaffold-hbar";
import { getParsedError, notification } from "~~/utils/scaffold-hbar";

const BURNER_WALLET_PK_KEY = "burnerWallet.pk";

export const RevealBurnerPKModal = () => {
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  const modalCheckboxRef = useRef<HTMLInputElement>(null);

  const handleCopyPK = async () => {
    try {
      const storage = rainbowkitBurnerWallet.useSessionStorage ? sessionStorage : localStorage;
      const burnerPK = storage?.getItem(BURNER_WALLET_PK_KEY);
      if (!burnerPK) throw new Error("Burner wallet private key not found");
      await copyToClipboard(burnerPK);
      notification.success("Burner wallet private key copied to clipboard");
    } catch (e) {
      const parsedError = getParsedError(e);
      notification.error(parsedError);
      if (modalCheckboxRef.current) modalCheckboxRef.current.checked = false;
    }
  };

  return (
    <div>
      <input type="checkbox" id="reveal-burner-pk-modal" className="modal-toggle" ref={modalCheckboxRef} />
      <label htmlFor="reveal-burner-pk-modal" className="modal cursor-pointer">
        <label className="modal-box bg-base-100 border-base-300 relative max-w-md rounded-2xl border p-6 shadow-xl">
          <input className="absolute left-0 top-0 h-0 w-0" />

          <label
            htmlFor="reveal-burner-pk-modal"
            className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content absolute right-3 top-3"
          >
            <XMarkIcon className="h-4 w-4" />
          </label>

          <div className="mb-5 flex items-center gap-3">
            <div className="hedera-gradient rounded-xl p-2">
              <KeyIcon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-base-content m-0 text-base font-semibold">Burner Wallet Private Key</h3>
          </div>

          <div className="bg-warning/10 border-warning/30 mb-4 flex items-start gap-3 rounded-xl border p-4">
            <ShieldExclamationIcon className="text-warning mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-warning m-0 text-sm font-medium">
              Burner wallets are for testnet development only. Never use for real funds.
            </p>
          </div>

          <p className="text-base-content/70 m-0 mb-5 text-sm">
            Your private key grants <span className="text-base-content font-semibold">full access</span> to this wallet.
            It is stored <span className="text-base-content font-semibold">temporarily</span> in your browser and will
            be lost if you clear site data.
          </p>

          <button className="btn btn-primary w-full gap-2" onClick={handleCopyPK} disabled={isCopiedToClipboard}>
            {isCopiedToClipboard ? (
              <>
                <CheckIcon className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy Private Key
              </>
            )}
          </button>
        </label>
      </label>
    </div>
  );
};

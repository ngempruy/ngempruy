import { useRef, useState } from "react";
import { rainbowkitBurnerWallet } from "burner-connector";
import type { Hex } from "viem";
import { useDisconnect } from "wagmi";
import { KeyIcon, PencilSquareIcon, ShieldExclamationIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getParsedError, notification } from "~~/utils/scaffold-hbar";

const BURNER_WALLET_PK_KEY = "burnerWallet.pk";

const normalizePrivateKey = (input: string): Hex => {
  const trimmed = input.trim().replace(/^0x/i, "");

  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("Private key must be 64 hexadecimal characters.");
  }

  return `0x${trimmed}` as Hex;
};

export const SetBurnerPKModal = () => {
  const { disconnect } = useDisconnect();
  const [pkInput, setPkInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const modalCheckboxRef = useRef<HTMLInputElement>(null);

  const handleSavePK = () => {
    try {
      setIsSaving(true);

      const normalizedPk = normalizePrivateKey(pkInput);
      const storage = rainbowkitBurnerWallet.useSessionStorage ? sessionStorage : localStorage;
      storage?.setItem(BURNER_WALLET_PK_KEY, normalizedPk);

      notification.success("Burner wallet private key updated. Wallet will be disconnected.");

      if (modalCheckboxRef.current) {
        modalCheckboxRef.current.checked = false;
      }

      disconnect();
    } catch (e) {
      const parsedError = getParsedError(e);
      notification.error(parsedError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <input type="checkbox" id="set-burner-pk-modal" className="modal-toggle" ref={modalCheckboxRef} />
      <label htmlFor="set-burner-pk-modal" className="modal cursor-pointer">
        <label className="modal-box bg-base-100 border-base-300 relative max-w-md rounded-2xl border p-6 shadow-xl">
          <input className="absolute left-0 top-0 h-0 w-0" />

          <label
            htmlFor="set-burner-pk-modal"
            className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content absolute right-3 top-3"
          >
            <XMarkIcon className="h-4 w-4" />
          </label>

          <div className="mb-5 flex items-center gap-3">
            <div className="hedera-gradient rounded-xl p-2">
              <KeyIcon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-base-content m-0 text-base font-semibold">Set Burner Wallet Private Key</h3>
          </div>

          <div className="bg-warning/10 border-warning/30 mb-4 flex items-start gap-3 rounded-xl border p-4">
            <ShieldExclamationIcon className="text-warning mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-warning m-0 text-sm font-medium">
              Only use this on localhost or testnets. Never paste a private key that controls real funds.
            </p>
          </div>

          <div className="form-control mb-4 w-full">
            <label className="label">
              <span className="label-text text-sm font-medium">Private key</span>
            </label>
            <div className="border-base-300 bg-base-200 focus-within:border-primary focus-within:ring-primary/60 flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:ring-1 focus-within:ring-offset-0">
              <PencilSquareIcon className="h-4 w-4 opacity-60" />
              <input
                type="text"
                className="grow border-none bg-transparent text-xs outline-none focus:outline-none sm:text-sm"
                placeholder="0x..."
                value={pkInput}
                onChange={e => setPkInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/60 text-xs">
                64 hex characters. Example: 0xabc123... (testnet only).
              </span>
            </label>
          </div>

          <button
            className="btn btn-primary w-full gap-2"
            onClick={handleSavePK}
            disabled={isSaving || !pkInput.trim()}
          >
            <KeyIcon className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Private Key"}
          </button>
        </label>
      </label>
    </div>
  );
};

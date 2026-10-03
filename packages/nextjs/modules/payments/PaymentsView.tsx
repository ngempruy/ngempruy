import { x402Config } from "~~/services/x402/config";
import { DirectTransfer } from "./DirectTransfer";
import { TryPaywall } from "./TryPaywall";

const ENDPOINT = "/api/x402/hbar-usd";

/** x402 paywall settings (server env) plus the two ways to pay: agent (x402) and wallet (direct). */
export const PaymentsView = () => {
  const config = x402Config();
  if (!config) return null;
  const priceHbar = Number(config.priceTinybars) / 1e8;

  return (
    <div className="flex flex-col gap-6">
      <section className="border-base-300 bg-base-100 flex flex-col gap-3 rounded-2xl border p-5">
        <h3 className="m-0 font-bold">x402 paywall</h3>
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-base-content/60">Endpoint</dt>
          <dd className="m-0 font-mono">GET {ENDPOINT}</dd>
          <dt className="text-base-content/60">Price</dt>
          <dd className="m-0">{priceHbar} HBAR per request</dd>
          <dt className="text-base-content/60">Pays to</dt>
          <dd className="m-0 font-mono">{config.payTo}</dd>
          <dt className="text-base-content/60">Facilitator</dt>
          <dd className="m-0 font-mono">{config.facilitatorUrl}</dd>
        </dl>
        <p className="m-0 text-sm">
          Agents pay with <code>yarn x402:pay</code>: the client signs a Hedera transfer, the facilitator co-signs as
          fee payer and submits it, and the settlement is written to the HCS audit log.
        </p>
        <TryPaywall endpoint={ENDPOINT} />
      </section>
      <DirectTransfer payTo={config.payTo} />
    </div>
  );
};

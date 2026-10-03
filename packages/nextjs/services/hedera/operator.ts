import { AccountId, Client, PrivateKey } from "@hiero-ledger/sdk";

/** Server-only SDK client paying with the operator from env. Callers must close() it. */
export function operatorClient() {
  const id = process.env.HEDERA_OPERATOR_ID;
  const key = process.env.HEDERA_OPERATOR_KEY;
  if (!id || !key) throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
  const privateKey = PrivateKey.fromStringECDSA(key.replace(/^0x/, ""));
  return { client: Client.forTestnet().setOperator(AccountId.fromString(id), privateKey), privateKey };
}

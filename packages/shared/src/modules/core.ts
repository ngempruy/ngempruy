import { defineModule } from "../define";

export const core = defineModule({
  id: "core",
  title: "Core",
  description: "Wallet, Hedera client, token registry and the HCS audit log every module writes to.",
  env: [
    {
      key: "HEDERA_OPERATOR_ID",
      description: "Testnet account id (0.0.x) that pays for HCS/HTS transactions",
      required: true,
    },
    {
      key: "HEDERA_OPERATOR_KEY",
      description: "ECDSA private key (hex) of HEDERA_OPERATOR_ID. Never commit it.",
      required: true,
    },
    {
      key: "NEXT_PUBLIC_AUDIT_TOPIC_ID",
      description: "Overrides the HCS audit topic that `yarn deploy` records in hederaResources.json",
      required: false,
    },
  ],
});

import resources from "~~/contracts/hederaResources.json";

type ChainResources = { auditTopicId?: string };
const byChain = resources as Record<string, ChainResources>;

/** Audit topic for a chain: env override first, then the id written by `yarn deploy`. */
export function auditTopicId(chainId: number): string | undefined {
  return process.env.NEXT_PUBLIC_AUDIT_TOPIC_ID?.trim() || byChain[chainId]?.auditTopicId;
}

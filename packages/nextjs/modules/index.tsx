import type { ComponentType } from "react";
import { AuditFeed } from "./core/AuditFeed";
import { PaymentsView } from "./payments/PaymentsView";
import { RwaView } from "./rwa/RwaView";

/**
 * UI per module id. Views render even while setup is incomplete (`ready` is false),
 * so read-only parts keep working; they must disable anything that needs the missing env.
 */
export const moduleViews: Record<string, ComponentType<{ ready: boolean }>> = {
  core: AuditFeed,
  rwa: RwaView,
  payments: PaymentsView,
};

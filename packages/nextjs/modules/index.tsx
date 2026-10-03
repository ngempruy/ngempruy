import type { ComponentType } from "react";

/**
 * UI per module id. A module without an entry still gets its page (title,
 * description, setup status); module PRs register their component here.
 */
export const moduleViews: Record<string, ComponentType> = {};

export type EnvVar = {
  key: string;
  description: string;
  /** Required vars disable the module in the UI until they are set. */
  required: boolean;
};

export type ModuleManifest = {
  id: string;
  title: string;
  description: string;
  /** Modules that must be selected for this one to work. */
  requires: string[];
  /** Modules used when present; their absence must be handled gracefully. */
  consumes: string[];
  /** Exclusive capabilities. Two selected modules may not provide the same one. */
  provides: string[];
  /** Contract names deployed for this module, in deploy order. */
  contracts: string[];
  env: EnvVar[];
};

export type IntegrationRecipe = {
  id: string;
  title: string;
  description: string;
  /** Active only when every listed module is selected. */
  when: string[];
  contracts: string[];
  env: EnvVar[];
};

export function defineModule(m: Partial<ModuleManifest> & Pick<ModuleManifest, "id" | "title" | "description">) {
  return { requires: [], consumes: [], provides: [], contracts: [], env: [], ...m } satisfies ModuleManifest;
}

export function defineIntegration(
  r: Partial<IntegrationRecipe> & Pick<IntegrationRecipe, "id" | "title" | "description" | "when">,
) {
  return { contracts: [], env: [], ...r } satisfies IntegrationRecipe;
}

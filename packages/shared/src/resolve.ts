import type { EnvVar, IntegrationRecipe, ModuleManifest } from "./define";

export type Resolution = {
  /** Selected modules plus their transitive `requires`, dependencies first. */
  modules: ModuleManifest[];
  integrations: IntegrationRecipe[];
  /** Contract names in deploy order: modules first, then integrations. */
  deployOrder: string[];
  env: EnvVar[];
};

export class ResolveError extends Error {}

export function resolveModules(
  selected: string[],
  catalog: ModuleManifest[],
  recipes: IntegrationRecipe[] = [],
): Resolution {
  const byId = new Map(catalog.map(m => [m.id, m]));
  const order: ModuleManifest[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (id: string, path: string[]) => {
    const m = byId.get(id);
    if (!m) {
      const via = path.length ? ` (required by ${path.at(-1)})` : "";
      throw new ResolveError(`Unknown module "${id}"${via}`);
    }
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") throw new ResolveError(`Dependency cycle: ${[...path, id].join(" -> ")}`);
    state.set(id, "visiting");
    for (const dep of m.requires) visit(dep, [...path, id]);
    state.set(id, "done");
    order.push(m);
  };
  for (const id of selected) visit(id, []);

  const providers = new Map<string, string>();
  for (const m of order) {
    for (const cap of m.provides) {
      const other = providers.get(cap);
      if (other) throw new ResolveError(`Conflict: "${other}" and "${m.id}" both provide "${cap}"`);
      providers.set(cap, m.id);
    }
  }

  const ids = new Set(order.map(m => m.id));
  const integrations = recipes.filter(r => r.when.every(id => ids.has(id)));

  const env = new Map<string, EnvVar>();
  for (const item of [...order, ...integrations]) for (const v of item.env) if (!env.has(v.key)) env.set(v.key, v);

  return {
    modules: order,
    integrations,
    deployOrder: [...order.flatMap(m => m.contracts), ...integrations.flatMap(r => r.contracts)],
    env: [...env.values()],
  };
}

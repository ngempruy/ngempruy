/**
 * yarn configure [--modules rwa,payments] [--dry-run]
 *
 * Picks modules, resolves dependencies and recipes, rewrites modules.config.ts, the Next.js
 * view registry and the generated part of packages/nextjs/.env.example, then deletes the files
 * and package scripts of everything not selected. Commit first: pruning deletes files.
 */
import checkbox from "@inquirer/checkbox";
import fs from "fs";
import path from "path";
import {
  type IntegrationRecipe,
  type ModuleManifest,
  ResolveError,
  modules as currentModules,
  prunePlan,
  renderEnvExample,
  renderModulesConfig,
  renderViewRegistry,
  resolveModules,
} from "../src";

const ROOT = path.resolve(__dirname, "../../..");
const SHARED_SRC = path.join(ROOT, "packages/shared/src");
const VIEWS_DIR = path.join(ROOT, "packages/nextjs/modules");
const ENV_EXAMPLE = path.join(ROOT, "packages/nextjs/.env.example");

async function loadManifests<T>(dir: string): Promise<T[]> {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts"));
  const loaded = await Promise.all(files.map(f => import(path.join(dir, f))));
  return loaded.flatMap(mod => Object.values(mod) as T[]).filter(m => typeof (m as { id?: unknown }).id === "string");
}

async function pickModules(catalog: ModuleManifest[]): Promise<string[]> {
  const flag = process.argv.indexOf("--modules");
  if (flag !== -1) return (process.argv[flag + 1] ?? "").split(",").filter(Boolean);
  const selected = new Set(currentModules.map(m => m.id));
  return checkbox({
    message: "Modules to keep (core is always included)",
    choices: catalog
      .filter(m => m.id !== "core")
      .map(m => ({ value: m.id, name: `${m.title}: ${m.description}`, checked: selected.has(m.id) })),
  });
}

/** Drops the given scripts and dependencies from the root and workspace package.json files. */
function prunePackageJsons(scripts: string[], dependencies: string[]) {
  if (scripts.length + dependencies.length === 0) return;
  const pkgs = [
    path.join(ROOT, "package.json"),
    ...["shared", "hardhat", "nextjs"].map(p => path.join(ROOT, "packages", p, "package.json")),
  ];
  for (const file of pkgs.filter(f => fs.existsSync(f))) {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const name of scripts) delete pkg.scripts?.[name];
    for (const name of dependencies) {
      delete pkg.dependencies?.[name];
      delete pkg.devDependencies?.[name];
    }
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

async function main() {
  const catalog = await loadManifests<ModuleManifest>(path.join(SHARED_SRC, "modules"));
  const recipes = await loadManifests<IntegrationRecipe>(path.join(SHARED_SRC, "integrations"));
  const resolution = resolveModules(["core", ...(await pickModules(catalog))], catalog, recipes);
  const plan = prunePlan(catalog, recipes, resolution);

  console.log(`Modules:      ${resolution.modules.map(m => m.id).join(", ")}`);
  console.log(`Recipes:      ${resolution.integrations.map(r => r.id).join(", ") || "none"}`);
  console.log(`Deploy order: ${resolution.deployOrder.join(" → ") || "no contracts"}`);
  console.log(`Removes:      ${plan.paths.length} paths, scripts: ${plan.scripts.join(", ") || "none"}`);
  console.log(`              dependencies: ${plan.dependencies.join(", ") || "none"}`);
  if (process.argv.includes("--dry-run")) return;

  for (const p of plan.paths) fs.rmSync(path.join(ROOT, p), { recursive: true, force: true });
  prunePackageJsons(plan.scripts, plan.dependencies);
  fs.writeFileSync(path.join(SHARED_SRC, "modules.config.ts"), renderModulesConfig(resolution));
  const withViews = resolution.modules.map(m => m.id).filter(id => fs.existsSync(path.join(VIEWS_DIR, id, "index.ts")));
  fs.writeFileSync(path.join(VIEWS_DIR, "index.tsx"), renderViewRegistry(withViews));
  fs.writeFileSync(ENV_EXAMPLE, renderEnvExample(fs.readFileSync(ENV_EXAMPLE, "utf8"), resolution.env));
  console.log("Done. Review with `git status`, then run `yarn install && yarn lint && yarn hardhat:test`.");
}

main().catch(e => {
  console.error(e instanceof ResolveError ? `Cannot configure: ${e.message}` : e);
  process.exit(1);
});

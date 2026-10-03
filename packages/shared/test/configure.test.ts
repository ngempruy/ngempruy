import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENV_MARKER,
  isSafeRepoPath,
  prunePlan,
  renderEnvExample,
  renderModulesConfig,
  renderViewRegistry,
} from "../src/configure";
import { defineIntegration, defineModule } from "../src/define";
import { resolveModules } from "../src/resolve";

const core = defineModule({ id: "core", title: "", description: "", paths: [] });
const rwa = defineModule({ id: "rwa", title: "", description: "", requires: ["core"], paths: ["a/rwa"] });
const pay = defineModule({
  id: "payments",
  title: "",
  description: "",
  requires: ["core"],
  paths: ["a/pay"],
  scripts: ["x402:pay"],
  dependencies: ["@x402/next"],
  env: [{ key: "PAY_TO", description: "Receiver", required: true }],
});
const recipe = defineIntegration({
  id: "rwa+payments",
  title: "",
  description: "",
  when: ["rwa", "payments"],
  paths: ["a/r"],
});
const catalog = [core, rwa, pay];

test("modules.config imports exactly the resolved modules and recipes", () => {
  const src = renderModulesConfig(resolveModules(["rwa", "payments"], catalog, [recipe]));
  assert.match(src, /import \{ rwaPayments \} from "\.\/integrations\/rwa\+payments";/);
  assert.match(src, /export const modules: ModuleManifest\[\] = \[core, rwa, payments\];/);
  assert.match(src, /export const integrations: IntegrationRecipe\[\] = \[rwaPayments\];/);
});

test("view registry imports one default view per module folder", () => {
  const src = renderViewRegistry(["core", "rwa"]);
  assert.match(src, /import rwaView from "\.\/rwa";/);
  assert.match(src, /^  rwa: rwaView,$/m);
});

test("env block is regenerated after the marker and keeps the hand-written head", () => {
  const first = renderEnvExample("BASE=1\n", pay.env);
  assert.equal(first, `BASE=1\n\n${ENV_MARKER}\n# Receiver\nPAY_TO=\n`);
  assert.equal(renderEnvExample(first, []), `BASE=1\n\n${ENV_MARKER}\n\n`);
});

test("prune plan drops unselected modules and inactive recipes, keeps the rest", () => {
  const plan = prunePlan(catalog, [recipe], resolveModules(["rwa"], catalog, [recipe]));
  assert.deepEqual(plan.paths.sort(), ["a/pay", "a/r"]);
  assert.deepEqual(plan.scripts, ["x402:pay"]);
  assert.deepEqual(plan.dependencies, ["@x402/next"]);
});

test("prune plan never removes what a kept module also owns", () => {
  const shared = defineModule({
    id: "shared-owner",
    title: "",
    description: "",
    paths: ["a/mock"],
    dependencies: ["dep"],
  });
  const other = defineModule({
    id: "other",
    title: "",
    description: "",
    paths: ["a/mock", "a/other"],
    dependencies: ["dep"],
  });
  const plan = prunePlan([core, shared, other], [], resolveModules(["shared-owner"], [core, shared, other]));
  assert.deepEqual(plan.paths, ["a/other"]);
  assert.deepEqual(plan.dependencies, []);
});

test("only relative paths inside the repo are safe to delete", () => {
  assert.ok(isSafeRepoPath("packages/nextjs/modules/rwa"));
  for (const bad of ["", ".", "..", "../outside", "a/../../b", "/etc", "C:\\x"])
    assert.equal(isSafeRepoPath(bad), false, bad);
});

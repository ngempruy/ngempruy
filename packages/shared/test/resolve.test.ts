import assert from "node:assert/strict";
import { test } from "node:test";
import { defineIntegration, defineModule } from "../src/define";
import { resolveModules } from "../src/resolve";

const core = defineModule({ id: "core", title: "Core", description: "", contracts: ["Core"] });
const dex = defineModule({
  id: "dex",
  title: "DEX",
  description: "",
  requires: ["core"],
  provides: ["swap"],
  contracts: ["Dex"],
});
const pay = defineModule({
  id: "payments",
  title: "Payments",
  description: "",
  requires: ["core"],
  env: [{ key: "PAY_TO", description: "", required: true }],
});
const recipe = defineIntegration({
  id: "dex+payments",
  title: "",
  description: "",
  when: ["dex", "payments"],
  contracts: ["Router"],
});
const catalog = [core, dex, pay];

test("pulls in transitive requires, dependencies first", () => {
  const r = resolveModules(["dex"], catalog);
  assert.deepEqual(
    r.modules.map(m => m.id),
    ["core", "dex"],
  );
  assert.deepEqual(r.deployOrder, ["Core", "Dex"]);
});

test("activates a recipe only when all its modules are selected", () => {
  assert.equal(resolveModules(["dex"], catalog, [recipe]).integrations.length, 0);
  const r = resolveModules(["dex", "payments"], catalog, [recipe]);
  assert.deepEqual(
    r.integrations.map(i => i.id),
    ["dex+payments"],
  );
  assert.deepEqual(r.deployOrder, ["Core", "Dex", "Router"]);
});

test("merges env vars without duplicates", () => {
  const r = resolveModules(["payments", "payments"], catalog);
  assert.deepEqual(
    r.env.map(v => v.key),
    ["PAY_TO"],
  );
});

test("rejects unknown modules and names the dependent", () => {
  const bad = defineModule({ id: "x", title: "", description: "", requires: ["nope"] });
  assert.throws(() => resolveModules(["x"], [bad]), /Unknown module "nope" \(required by x\)/);
});

test("rejects cycles", () => {
  const a = defineModule({ id: "a", title: "", description: "", requires: ["b"] });
  const b = defineModule({ id: "b", title: "", description: "", requires: ["a"] });
  assert.throws(() => resolveModules(["a"], [a, b]), /cycle: a -> b -> a/);
});

test("rejects two modules providing the same capability", () => {
  const dex2 = defineModule({ id: "dex2", title: "", description: "", provides: ["swap"] });
  assert.throws(() => resolveModules(["dex", "dex2"], [...catalog, dex2]), /"dex" and "dex2" both provide "swap"/);
});


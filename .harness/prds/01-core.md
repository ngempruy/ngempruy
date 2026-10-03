# 01 — Core: module system and HCS audit log (delivered)

- `@sh/shared`: `defineModule` / `defineIntegration`, `resolveModules` (topological `requires`, capability conflicts, recipe activation), `yarn configure`.
- App shell: nav and `/modules/[id]` generated from `modules.config.ts`; missing required env renders a setup hint, never a crash.
- HCS: `deploy/00_core_audit_topic.ts` creates the topic (submit key = deployer) and records it in `hederaResources.json`; `/api/audit` turns a confirmed kit-contract transaction into one entry per event; the core page reads the topic from the mirror node.
- Testnet: topic `0.0.10843261`.

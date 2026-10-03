# 04 — Staking module (next increment)

Add a `staking` module that lets the operator account stake HBAR to a consensus node, using the SDK only (no contract).

## Must

- Manifest `packages/shared/src/modules/staking.ts`: `requires: ["core"]`, env reuses the core operator, and `paths` lists every file this increment adds so `yarn configure --modules rwa,payments` removes all of it.
- Server route `POST /api/staking` with `{ nodeId }` → `AccountUpdateTransaction().setAccountId(operator).setStakedNodeId(nodeId)`; reject node ids not returned by the mirror node `/api/v1/network/nodes`. Write `staking / node.staked` to the HCS audit log via `postAuditEntry`.
- Page `packages/nextjs/modules/staking/index.ts` (default-exported view): node list with stake and reward rate from the mirror node (works without env), current staking of the operator, a form to change it that is disabled when `ready` is false.
- `yarn configure --modules rwa,payments,staking` regenerates config, registry and `.env.example` with no manual edits.

## Must not

- Import another module, add a contract, or put the operator key in client code.

## Done when

- The validators pass, `/modules/staking` renders without env, and on testnet the operator's `staked_node_id` on the mirror node equals the chosen node with an audit entry on topic `0.0.10843261`.

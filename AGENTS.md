# Agent instructions

Briefing for coding agents (Claude Code, Cursor, Codex) working in a Hedera DeFi Kit project. Read `README.md` for the product view; this file is the working contract.

The project was created with Yarn or npm (see `packageManager` / the lockfile). Examples use `yarn <script>`; with npm use `npm run <script>`.

## Commands

```bash
yarn next:dev                                # app on :3000, needs no wallet or .env
yarn configure --modules rwa,payments        # pick modules (prunes the rest; commit first)
yarn hardhat:test                            # contracts (testnet fork + MockHts for KYC)
yarn shared:test                             # resolver, configure, audit format
yarn lint && yarn format:check && yarn next:check-types
yarn next:build

yarn hardhat:account:generate                # ECDSA deployer, encrypted in packages/hardhat/.env
yarn hardhat:deploy --network hederaTestnet  # audit topic + selected modules
yarn demo                                    # every module's testnet flow, prints HashScan links
yarn x402:pay [url]                          # agent pays an x402 endpoint (payments module)
```

Non-interactive deploys and demos: export `DEPLOYER_PRIVATE_KEY` (plain hex) instead of using the encrypted keystore. Never write a key into a tracked file.

## Map

| Path                                             | Owns                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/modules/<id>.ts`            | Module manifest: `requires`, `consumes`, `provides`, `contracts`, `env`, `paths`, `scripts`, `dependencies` |
| `packages/shared/src/integrations/<a>+<b>.ts`    | Recipe for a module pair, active only when all `when` modules are selected                                  |
| `packages/shared/src/modules.config.ts`          | The selection. **Generated** by `yarn configure`                                                            |
| `packages/hardhat/contracts/core/`               | Shared interfaces (`IPriceOracle`, `ISwapAdapter`)                                                          |
| `packages/hardhat/contracts/adapters/`           | Provider implementations behind those interfaces                                                            |
| `packages/hardhat/contracts/modules/<id>/`       | Module contracts                                                                                            |
| `packages/hardhat/deploy/NN_<id>.ts`             | Deploy step per module (`00` core, `10` rwa, …)                                                             |
| `packages/hardhat/scripts/demo/<id>.ts`          | Demo step per module, run by `yarn demo`                                                                    |
| `packages/nextjs/modules/<id>/index.ts`          | Default-exported page view, receives `{ ready }`                                                            |
| `packages/nextjs/modules/index.tsx`              | View registry. **Generated**                                                                                |
| `packages/nextjs/contracts/deployedContracts.ts` | ABIs + addresses. **Generated** by deploy                                                                   |
| `packages/nextjs/contracts/hederaResources.json` | Topic and token ids per chain. **Written** by deploy                                                        |
| `packages/nextjs/app/api/audit/route.ts`         | Confirmed kit tx → HCS audit entries                                                                        |

## Invariants

1. **Modules never import each other.** Cross-module behaviour goes through `contracts/core` interfaces or a recipe in `integrations/`. A module that `consumes` another must work when it is absent.
2. **The manifest is the source of truth.** Adding a contract, env var, file, script or npm dependency to a module means adding it to the manifest's `contracts` / `env` / `paths` / `scripts` / `dependencies`. Otherwise `configure` leaves dead files behind or breaks the build. CI runs every single-module configuration to catch this.
3. **Do not hand-edit generated files.** Run `yarn configure --modules <current selection>` after manifest changes.
4. **Every kit contract event is an audit entry.** Name events for what happened (`KycGranted`, `NavPosted`). `/api/audit` and `yarn demo` log them through `auditEntryFromEvent`; do not post free-form HCS messages from modules.
5. **No secrets in the client.** Only `NEXT_PUBLIC_*` reaches the browser. Operator keys stay server-side (`services/hedera/operator.ts`).
6. **Errors carry the cause.** Contracts revert with custom errors (e.g. `HtsCallFailed(selector, code)`), not bare `require` strings. HTS response codes are surfaced, never swallowed.

## Hedera rules to respect

- HTS tokens must be **associated** before an account or contract can receive them; users associate via HIP-719 (`associate()` on the token address).
- **KYC requires association first** (code `184` otherwise). Contracts that hold a KYC-gated token (pairs, routers, pools) also need association **and** KYC.
- EVM accounts and Hardhat use **ECDSA** keys. JSON-RPC `value` is in **weibars** (10¹⁸ per HBAR); the SDK and x402 use **tinybars** (10⁸).
- System contracts: HTS `0x167`, exchange rate `0x168`, schedule service `0x16b` (HIP-1215).
- Do not use atomic batch transactions for contract calls (at most one, last; removed in 2027). Hooks (HIP-1195) are not live.
- x402 on Hedera is a native transfer signed by the client and submitted by the facilitator (fee payer). The client signs only.
- Testnet USDC: SaucerSwap/Bonzo pools use `0.0.5449`; Circle's faucet token is `0.0.429274` (no SaucerSwap pool).

Official Hedera agent skills that match this codebase: `hedera-token-service`, `hts-system-contract`, `hss-system-contract`, `hedera-consensus-service` (install with `npx skills add hedera-dev/hedera-skills`).

## Frontend

Hooks live in `packages/nextjs/hooks/scaffold-hbar`; use the names that exist: `useScaffoldReadContract`, `useScaffoldWriteContract`, `useScaffoldEventHistory`, `useDeployedContractInfo`, `useTransactor`. After a kit transaction, call `recordAudit(hash)` from `~~/utils/recordAudit`.

Use DaisyUI components (`btn`, `input`, `alert`, `badge`) before raw Tailwind. Imports use the `~~` alias; Prettier sorts them (react → next → packages → `@sh/*` → `~~/*` → relative).

## Style

- `type` over `interface`, no `T` prefixes, let TypeScript infer.
- Comments explain why, not what.
- A deliberate shortcut gets a `ponytail:` comment that names its limit and the upgrade path.
- Small commits; every change goes through an issue and a PR.

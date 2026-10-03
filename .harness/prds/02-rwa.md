# 02 — RWA: HTS token with a contract-held KYC key + NAV oracle (delivered)

- `RwaToken`: treasury, KYC key and supply key are the contract; `grantKyc` / `revokeKyc` / `issue` are role-gated (AccessControl) and call HTS at `0x167`; non-SUCCESS codes revert as `HtsCallFailed(selector, code)`.
- `RwaNavOracle`: appraiser posts NAV per unit (USD, 18 decimals) with a report URI; `navPerUnit(maxAge)` rejects stale data; `maxDeviationBps` rejects fat-finger moves.
- Order enforced by HTS and documented: associate (HIP-719) → grant KYC → issue. KYC on an unassociated account returns 184.
- Testnet: token `0.0.10843354`, contracts `0.0.10843352` / `0.0.10843308`.

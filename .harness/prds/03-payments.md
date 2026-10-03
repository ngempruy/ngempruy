# 03 — Payments: x402 through a hosted facilitator (delivered)

- `GET /api/x402/hbar-usd` wrapped with `@x402/next` + `@x402/hedera` (`exact`, `hedera:testnet`, HBAR asset `0.0.0`); settles only after a successful response; `afterSettle` writes `payments / x402.settled` to HCS.
- `yarn x402:pay`: sign-only client; the facilitator (Blocky402, fee payer `0.0.7162784`) submits. Spend controls allow HBAR only, ≤ 0.1 HBAR per request.
- Without `X402_PAY_TO` the route answers 503 with a setup message.

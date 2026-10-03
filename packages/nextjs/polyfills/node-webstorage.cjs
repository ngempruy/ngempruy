// Preloaded into every Next.js process (see package.json scripts).
// Node 25 defines a global `localStorage` stub without `getItem` unless --localstorage-file is set.
// Libraries that feature-detect `typeof localStorage` (RainbowKit's recent wallets) then crash on
// the server, so remove the stub and let them take their server path. No-op on Node < 25.
if (typeof globalThis.localStorage?.getItem !== "function") {
  delete globalThis.localStorage;
}

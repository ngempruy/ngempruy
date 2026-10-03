// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Provider-agnostic USD price feed. Implemented by the Pyth, Chainlink and mock adapters
/// (market assets) and by the RWA NAV oracle (asset valuation).
interface IPriceOracle {
    error NoFeed(address asset);
    error StalePrice(address asset, uint256 updatedAt);
    error InvalidPrice(address asset);

    /// USD price of one whole unit of `asset`, scaled to 18 decimals.
    /// Reverts with `NoFeed`, `StalePrice` or `InvalidPrice`.
    /// @return price USD price with 18 decimals
    /// @return updatedAt Unix timestamp of the underlying observation
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt);
}

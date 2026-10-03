// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Provider-agnostic USD price feed. Implemented by the Pyth, Chainlink and mock adapters
/// (market assets) and by the RWA NAV oracle (asset valuation).
interface IPriceOracle {
    /// USD price of one whole unit of `asset`, scaled to 18 decimals.
    /// Reverts when the price is stale, non-positive or `asset` has no feed.
    /// @return price USD price with 18 decimals
    /// @return updatedAt Unix timestamp of the underlying observation
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt);
}

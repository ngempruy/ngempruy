// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Rescales a fixed-point price with `decimals` decimals to 18 decimals.
library PriceScale {
    function toWad(uint256 value, uint256 decimals) internal pure returns (uint256) {
        if (decimals == 18) return value;
        if (decimals < 18) return value * 10 ** (18 - decimals);
        return value / 10 ** (decimals - 18);
    }
}

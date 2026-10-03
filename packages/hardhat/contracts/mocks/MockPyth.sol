// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IPyth } from "../adapters/PythOracleAdapter.sol";

/// Test double for the Pyth contract.
contract MockPyth {
    mapping(bytes32 id => IPyth.Price) private prices;

    function setPrice(bytes32 id, int64 price, int32 expo, uint256 publishTime) external {
        prices[id] = IPyth.Price(price, 0, expo, publishTime);
    }

    function getPriceUnsafe(bytes32 id) external view returns (IPyth.Price memory) {
        return prices[id];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPriceOracle } from "../core/IPriceOracle.sol";

/// IPriceOracle with owner-set prices, for tests and local runs (ORACLE_PROVIDER=mock).
contract MockOracleAdapter is IPriceOracle, Ownable {
    struct Quote {
        uint256 price; // 18 decimals
        uint256 updatedAt;
    }

    mapping(address asset => Quote) public quotes;

    event PriceSet(address indexed asset, uint256 price);

    constructor(address owner_) Ownable(owner_) {}

    function setPrice(address asset, uint256 price) external onlyOwner {
        quotes[asset] = Quote(price, block.timestamp);
        emit PriceSet(asset, price);
    }

    function getPrice(address asset) external view returns (uint256, uint256) {
        Quote memory q = quotes[asset];
        if (q.price == 0) revert NoFeed(asset);
        return (q.price, q.updatedAt);
    }
}

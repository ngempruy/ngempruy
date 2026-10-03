// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Test double for a Chainlink AggregatorV3 feed.
contract MockChainlinkAggregator {
    uint8 public immutable decimals;
    int256 private answer;
    uint256 private updatedAt;

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }

    function setRound(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPriceOracle } from "../core/IPriceOracle.sol";
import { PriceScale } from "./PriceScale.sol";

/// Subset of Chainlink's AggregatorV3Interface used by the adapter.
interface IChainlinkAggregator {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// IPriceOracle backed by Chainlink Data Feeds.
/// Hedera testnet HBAR/USD proxy: 0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a (8 decimals).
contract ChainlinkOracleAdapter is IPriceOracle, Ownable {
    struct Feed {
        IChainlinkAggregator aggregator;
        uint256 maxAge; // seconds; match the feed's heartbeat
    }

    mapping(address asset => Feed) public feeds;

    event FeedSet(address indexed asset, address aggregator, uint256 maxAge);

    constructor(address owner_) Ownable(owner_) {}

    /// Pass `aggregator = address(0)` to remove the feed.
    function setFeed(address asset, address aggregator, uint256 maxAge) external onlyOwner {
        feeds[asset] = Feed(IChainlinkAggregator(aggregator), maxAge);
        emit FeedSet(asset, aggregator, maxAge);
    }

    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        Feed memory feed = feeds[asset];
        if (address(feed.aggregator) == address(0)) revert NoFeed(asset);

        int256 answer;
        (, answer, , updatedAt, ) = feed.aggregator.latestRoundData();
        if (answer <= 0) revert InvalidPrice(asset);
        if (block.timestamp - updatedAt > feed.maxAge) revert StalePrice(asset, updatedAt);

        price = PriceScale.toWad(uint256(answer), feed.aggregator.decimals());
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPriceOracle } from "../core/IPriceOracle.sol";
import { PriceScale } from "./PriceScale.sol";

/// Subset of the Pyth contract used by the adapter.
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
}

/// IPriceOracle backed by Pyth (pull oracle). Pyth only stores what was last pushed, so push
/// fresh data first: fetch updateData from Hermes and call `pyth.updatePriceFeeds{value: fee}`.
/// Hedera testnet Pyth: 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729.
contract PythOracleAdapter is IPriceOracle, Ownable {
    struct Feed {
        bytes32 priceId;
        uint256 maxAge; // seconds
    }

    IPyth public immutable pyth;
    mapping(address asset => Feed) public feeds;

    event FeedSet(address indexed asset, bytes32 priceId, uint256 maxAge);

    constructor(address owner_, IPyth pyth_) Ownable(owner_) {
        pyth = pyth_;
    }

    /// Pass `priceId = 0` to remove the feed.
    function setFeed(address asset, bytes32 priceId, uint256 maxAge) external onlyOwner {
        feeds[asset] = Feed(priceId, maxAge);
        emit FeedSet(asset, priceId, maxAge);
    }

    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        Feed memory feed = feeds[asset];
        if (feed.priceId == bytes32(0)) revert NoFeed(asset);

        IPyth.Price memory p = pyth.getPriceUnsafe(feed.priceId);
        // Pyth prices are price * 10^expo with expo <= 0 for USD feeds.
        if (p.price <= 0 || p.expo > 0) revert InvalidPrice(asset);
        updatedAt = p.publishTime;
        if (block.timestamp - updatedAt > feed.maxAge) revert StalePrice(asset, updatedAt);

        price = PriceScale.toWad(uint256(uint64(p.price)), uint256(uint32(-p.expo)));
    }
}

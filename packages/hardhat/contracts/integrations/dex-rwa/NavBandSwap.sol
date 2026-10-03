// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { HtsAssociation } from "../../core/HtsAssociation.sol";
import { ISwapAdapter } from "../../core/ISwapAdapter.sol";
import { RwaNavOracle } from "../../modules/rwa/RwaNavOracle.sol";

/// @title NavBandSwap (recipe dex+rwa)
/// @notice Buys RWA units on a DEX only when the price paid stays within `bandBps` above the
/// appraised NAV. Thin RWA pools are easy to move, so the NAV oracle is the reference and the
/// pool only executes. The quote token is assumed to be a USD stablecoin (testnet USDC 0.0.5449).
/// The buyer receives the units directly from the pool, so it must be associated and KYC'd.
contract NavBandSwap is HtsAssociation {
    using SafeERC20 for IERC20;

    ISwapAdapter public immutable adapter;
    RwaNavOracle public immutable oracle;
    address public immutable rwaToken;
    address public immutable quoteToken;
    uint8 public immutable rwaDecimals;
    uint8 public immutable quoteDecimals;
    /// NAV older than this (seconds) is refused.
    uint256 public immutable maxNavAge;
    /// Largest premium over NAV a buyer pays, in basis points.
    uint16 public immutable bandBps;

    event BoughtNearNav(address indexed buyer, uint256 quoteIn, uint256 rwaOut, uint256 navPerUnit, int256 premiumBps);

    error NoLiquidity();
    error UnsupportedDecimals();
    error AboveNavBand(int256 premiumBps, uint16 bandBps);

    constructor(
        ISwapAdapter adapter_,
        RwaNavOracle oracle_,
        address rwaToken_,
        uint8 rwaDecimals_,
        address quoteToken_,
        uint8 quoteDecimals_,
        uint256 maxNavAge_,
        uint16 bandBps_
    ) {
        if (rwaDecimals_ > 18 || quoteDecimals_ > 18) revert UnsupportedDecimals();
        adapter = adapter_;
        oracle = oracle_;
        rwaToken = rwaToken_;
        rwaDecimals = rwaDecimals_;
        quoteToken = quoteToken_;
        quoteDecimals = quoteDecimals_;
        maxNavAge = maxNavAge_;
        bandBps = bandBps_;
    }

    /// The contract holds the quote token for a moment during `buy`, so it must be associated.
    /// Idempotent and only ever associates the configured quote token, so anyone may call it.
    function associateQuoteToken() external {
        _associate(quoteToken);
    }

    /// What `quoteIn` buys right now and how far the effective price sits from NAV
    /// (positive = premium, negative = discount), in basis points.
    function previewBuy(uint256 quoteIn) public view returns (uint256 rwaOut, uint256 nav, int256 premiumBps) {
        rwaOut = adapter.quote(quoteIn, _path());
        nav = oracle.navPerUnit(maxNavAge);
        premiumBps = _premiumBps(quoteIn, rwaOut, nav);
    }

    /// Checks the band on the quote and again on what was actually received, so an HTS custom
    /// fee on the RWA token cannot push the real price above the band unnoticed.
    function buy(uint256 quoteIn, uint256 minRwaOut, uint256 deadline) external returns (uint256 rwaOut) {
        (, uint256 nav, int256 quotedPremium) = previewBuy(quoteIn);
        _checkBand(quotedPremium);

        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), quoteIn);
        IERC20(quoteToken).forceApprove(address(adapter), quoteIn);
        rwaOut = adapter.swap(quoteIn, minRwaOut, _path(), msg.sender, deadline);

        int256 premiumBps = _premiumBps(quoteIn, rwaOut, nav);
        _checkBand(premiumBps);
        emit BoughtNearNav(msg.sender, quoteIn, rwaOut, nav, premiumBps);
    }

    /// USD paid per whole RWA unit (18 decimals) relative to NAV, in basis points.
    function _premiumBps(uint256 quoteIn, uint256 rwaOut, uint256 nav) internal view returns (int256) {
        if (rwaOut == 0) revert NoLiquidity();
        uint256 paid = (quoteIn * 10 ** (18 - quoteDecimals) * 10 ** rwaDecimals) / rwaOut;
        return ((int256(paid) - int256(nav)) * 10_000) / int256(nav);
    }

    function _checkBand(int256 premiumBps) internal view {
        if (premiumBps > int256(uint256(bandBps))) revert AboveNavBand(premiumBps, bandBps);
    }

    function _path() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = quoteToken;
        path[1] = rwaToken;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RwaNavOracle
/// @notice Net asset value per token unit, posted by an appraiser. Public feeds (Pyth,
/// Chainlink) price market assets, not a specific building or loan book, so an RWA needs
/// its own valuation source. Consumers must pass the staleness they accept.
contract RwaNavOracle is AccessControl {
    bytes32 public constant APPRAISER_ROLE = keccak256("APPRAISER_ROLE");

    /// NAV is USD per whole token unit with 18 decimals.
    uint8 public constant DECIMALS = 18;

    /// Largest allowed move between two posts, in basis points (0 = unlimited).
    /// Catches fat-finger posts; a real revaluation above it needs the admin to raise the limit.
    uint16 public maxDeviationBps;

    uint256 public round;
    uint256 public nav;
    uint64 public updatedAt;

    event NavPosted(uint256 indexed round, uint256 navPerUnit, string reportUri, address indexed appraiser);
    event MaxDeviationUpdated(uint16 maxDeviationBps);

    error ZeroNav();
    error DeviationTooHigh(uint256 previous, uint256 next, uint16 maxDeviationBps);
    error NoNav();
    error StaleNav(uint64 updatedAt, uint256 maxAge);

    constructor(address admin, uint16 maxDeviationBps_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(APPRAISER_ROLE, admin);
        maxDeviationBps = maxDeviationBps_;
    }

    /// @param reportUri Where the signed appraisal lives (IPFS, HCS message, URL).
    function postNav(uint256 newNav, string calldata reportUri) external onlyRole(APPRAISER_ROLE) {
        if (newNav == 0) revert ZeroNav();
        uint256 previous = nav;
        if (previous != 0 && maxDeviationBps != 0) {
            uint256 diff = newNav > previous ? newNav - previous : previous - newNav;
            if (diff * 10_000 > previous * maxDeviationBps) {
                revert DeviationTooHigh(previous, newNav, maxDeviationBps);
            }
        }
        nav = newNav;
        updatedAt = uint64(block.timestamp);
        emit NavPosted(++round, newNav, reportUri, msg.sender);
    }

    function setMaxDeviationBps(uint16 maxDeviationBps_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxDeviationBps = maxDeviationBps_;
        emit MaxDeviationUpdated(maxDeviationBps_);
    }

    /// NAV per unit, reverting when none was posted or it is older than `maxAge` seconds.
    function navPerUnit(uint256 maxAge) external view returns (uint256) {
        if (updatedAt == 0) revert NoNav();
        if (block.timestamp - updatedAt > maxAge) revert StaleNav(updatedAt, maxAge);
        return nav;
    }
}

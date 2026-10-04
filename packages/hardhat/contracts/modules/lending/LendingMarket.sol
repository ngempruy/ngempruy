// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { HtsAssociation } from "../../core/HtsAssociation.sol";
import { IPriceOracle } from "../../core/IPriceOracle.sol";

/// Subset of the Hedera Schedule Service system contract (HIP-1215). Calls never revert; they return a
/// HAPI response code (22 = SUCCESS).
interface IHederaScheduleService {
    function scheduleCall(
        address to,
        uint256 expirySecond,
        uint256 gasLimit,
        uint64 value,
        bytes memory callData
    ) external returns (int64 responseCode, address scheduleAddress);

    function hasScheduleCapacity(uint256 expirySecond, uint256 gasLimit) external view returns (bool);
}

/// @title LendingMarket
/// @notice Overcollateralised USDC loans against one collateral token priced by IPriceOracle, with
/// health checks the contract schedules for itself through HIP-1215: every open loan has a pending
/// `checkPosition` call. A healthy position is re-checked one interval later; one past the liquidation
/// threshold has its collateral seized into protocol reserves and its debt cleared, with no keeper or
/// external liquidator needed.
/// @dev The contract pays for its scheduled calls (~1.7 HBAR each on testnet at CHECK_GAS), so it must
/// hold HBAR: send some to it, `withdrawHbar` takes it back. No interest
/// accrues; liquidity is supplied by the owner. Unaudited, testnet/education only.
contract LendingMarket is HtsAssociation, Ownable {
    using SafeERC20 for IERC20;

    IHederaScheduleService private constant HSS = IHederaScheduleService(address(0x16b));
    int64 private constant HTS_SUCCESS = 22;
    /// Gas for each scheduled check. It must cover rescheduling: a `scheduleCall` costs the canonical
    /// ScheduleCreate price (~$0.10, about 1.5M gas on testnet), however small the scheduled call is.
    uint256 public constant CHECK_GAS = 2_000_000;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable collateral;
    uint8 public immutable collateralDecimals;
    IERC20 public immutable usdc;
    IPriceOracle public immutable oracle;

    /// Max debt as a share of collateral value when borrowing or withdrawing.
    uint16 public maxLtvBps;
    /// Debt above this share of collateral value gets liquidated.
    uint16 public liquidationThresholdBps;
    /// Seconds between scheduled health checks.
    uint32 public checkInterval;

    struct Position {
        uint256 collateral;
        uint256 debt; // USDC, 6 decimals
        uint64 nextCheck; // pending scheduled check (unix seconds), 0 = none
    }
    mapping(address user => Position) public positions;
    /// Collateral seized from liquidated positions, withdrawable by the owner.
    uint256 public reserves;

    error ZeroAmount();
    error InvalidRiskParams();
    error ExceedsLtv(uint256 debtUsd, uint256 maxDebtUsd);
    error InsufficientLiquidity(uint256 available);
    error ScheduleFailed(int64 responseCode);
    error HbarTransferFailed();

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event CheckScheduled(address indexed user, uint256 expirySecond, address schedule);
    event CheckScheduleFailed(address indexed user, int64 responseCode);
    event PositionChecked(address indexed user, uint256 debtUsd, uint256 collateralUsd, bool priceAvailable);
    event Liquidated(address indexed user, uint256 collateralSeized, uint256 debtCleared);
    event RiskParamsSet(uint16 maxLtvBps, uint16 liquidationThresholdBps, uint32 checkInterval);

    constructor(
        address owner_,
        IERC20 collateral_,
        uint8 collateralDecimals_,
        IERC20 usdc_,
        IPriceOracle oracle_,
        uint16 maxLtvBps_,
        uint16 liquidationThresholdBps_,
        uint32 checkInterval_
    ) Ownable(owner_) {
        collateral = collateral_;
        collateralDecimals = collateralDecimals_;
        usdc = usdc_;
        oracle = oracle_;
        _setRiskParams(maxLtvBps_, liquidationThresholdBps_, checkInterval_);
    }

    /// Pays for scheduled health checks.
    receive() external payable {}

    function associate(address token) external onlyOwner {
        _associate(token);
    }

    function setRiskParams(
        uint16 maxLtvBps_,
        uint16 liquidationThresholdBps_,
        uint32 checkInterval_
    ) external onlyOwner {
        _setRiskParams(maxLtvBps_, liquidationThresholdBps_, checkInterval_);
    }

    function supplyLiquidity(uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdrawLiquidity(uint256 amount) external onlyOwner {
        usdc.safeTransfer(msg.sender, amount);
    }

    function withdrawReserves(uint256 amount) external onlyOwner {
        reserves -= amount;
        collateral.safeTransfer(msg.sender, amount);
    }

    /// Returns HBAR not needed for future scheduled checks.
    function withdrawHbar(uint256 amount) external onlyOwner {
        (bool ok, ) = payable(msg.sender).call{ value: amount }("");
        if (!ok) revert HbarTransferFailed();
    }

    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        positions[msg.sender].collateral += amount;
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Position storage p = positions[msg.sender];
        p.collateral -= amount;
        _requireWithinLtv(p);
        collateral.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// Borrows USDC up to `maxLtvBps` of the collateral value and makes sure a health check is scheduled.
    function borrow(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 available = usdc.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(available);
        Position storage p = positions[msg.sender];
        p.debt += amount;
        _requireWithinLtv(p);
        if (p.nextCheck <= block.timestamp) {
            // A loan must never be left unmonitored.
            int64 code = _scheduleCheck(msg.sender);
            if (code != HTS_SUCCESS) revert ScheduleFailed(code);
        }
        usdc.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        Position storage p = positions[msg.sender];
        if (amount > p.debt) amount = p.debt;
        if (amount == 0) revert ZeroAmount();
        p.debt -= amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Repaid(msg.sender, amount);
    }

    /// Scheduled through HIP-1215 for every open loan; anyone may also call it. Liquidates only when the
    /// debt is above the liquidation threshold, so calling it early is harmless. An unavailable price
    /// (stale feed) never liquidates; the check is simply rescheduled.
    function checkPosition(address user) external {
        Position storage p = positions[user];
        if (p.nextCheck <= block.timestamp) p.nextCheck = 0;
        if (p.debt == 0) return;

        (bool priceAvailable, uint256 collateralUsd) = _tryCollateralUsd(p.collateral);
        uint256 debtUsd = p.debt * 1e12;
        emit PositionChecked(user, debtUsd, collateralUsd, priceAvailable);

        if (priceAvailable && debtUsd * BPS > collateralUsd * liquidationThresholdBps) {
            emit Liquidated(user, p.collateral, p.debt);
            reserves += p.collateral;
            delete positions[user];
            return;
        }
        // Not reverting here: the health check above must stand even if rescheduling fails (contract out of
        // HBAR, busy seconds). The position stays unscheduled until the next borrow or manual check.
        if (p.nextCheck == 0) _scheduleCheck(user);
    }

    /// Debt over collateral value at the current price, in basis points (type(uint256).max without collateral).
    function ltvBps(address user) external view returns (uint256) {
        Position memory p = positions[user];
        if (p.debt == 0) return 0;
        uint256 collateralUsd = _collateralUsd(p.collateral);
        return collateralUsd == 0 ? type(uint256).max : (p.debt * 1e12 * BPS) / collateralUsd;
    }

    /// Schedules `checkPosition(user)` one interval from now; returns the HAPI response code.
    function _scheduleCheck(address user) private returns (int64 code) {
        uint256 expiry = block.timestamp + checkInterval;
        // HIP-1215 suggests probing nearby seconds when one is saturated.
        for (uint256 i; i < 4 && !HSS.hasScheduleCapacity(expiry, CHECK_GAS); ++i) {
            expiry += 1 << i;
        }
        address schedule;
        (code, schedule) = HSS.scheduleCall(
            address(this),
            expiry,
            CHECK_GAS,
            0,
            abi.encodeCall(this.checkPosition, (user))
        );
        if (code == HTS_SUCCESS) {
            positions[user].nextCheck = uint64(expiry);
            emit CheckScheduled(user, expiry, schedule);
        } else {
            emit CheckScheduleFailed(user, code);
        }
    }

    function _requireWithinLtv(Position storage p) private view {
        if (p.debt == 0) return;
        uint256 maxDebtUsd = (_collateralUsd(p.collateral) * maxLtvBps) / BPS;
        uint256 debtUsd = p.debt * 1e12;
        if (debtUsd > maxDebtUsd) revert ExceedsLtv(debtUsd, maxDebtUsd);
    }

    /// USD value with 18 decimals; reverts if the oracle has no fresh price.
    function _collateralUsd(uint256 amount) private view returns (uint256) {
        (uint256 price, ) = oracle.getPrice(address(collateral));
        return (amount * price) / 10 ** collateralDecimals;
    }

    function _tryCollateralUsd(uint256 amount) private view returns (bool, uint256) {
        try oracle.getPrice(address(collateral)) returns (uint256 price, uint256) {
            return (true, (amount * price) / 10 ** collateralDecimals);
        } catch {
            return (false, 0);
        }
    }

    function _setRiskParams(uint16 maxLtvBps_, uint16 liquidationThresholdBps_, uint32 checkInterval_) private {
        if (
            maxLtvBps_ == 0 ||
            maxLtvBps_ > liquidationThresholdBps_ ||
            liquidationThresholdBps_ > BPS ||
            checkInterval_ == 0
        ) {
            revert InvalidRiskParams();
        }
        (maxLtvBps, liquidationThresholdBps, checkInterval) = (maxLtvBps_, liquidationThresholdBps_, checkInterval_);
        emit RiskParamsSet(maxLtvBps_, liquidationThresholdBps_, checkInterval_);
    }
}

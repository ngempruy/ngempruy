// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { HtsAssociation } from "../../core/HtsAssociation.sol";
import { ISwapAdapter } from "../../core/ISwapAdapter.sol";

/// Subset of the Bonzo Lend (Aave v2) LendingPool: the flash loan source for BonzoFlashLoan and the
/// liquidation venue for every provider.
interface IBonzoLendingPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;
}

/// Strategies run inside a flash loan, independent of where the loan comes from. A provider implements
/// `_flashLoan` and calls `_runStrategy` from its callback, then repays what it returns.
///
/// `minPnl` bounds the result in the borrowed asset: positive = required profit, negative = the most the
/// owner is willing to pay (pulled from the owner, who must approve this contract). The legs swap with
/// no per-leg minimum because the transaction reverts unless the final PnL clears `minPnl`.
///
/// Hedera: associate every HTS token a strategy touches (`associate`) first. Unaudited, testnet/education.
abstract contract FlashLoanStrategies is HtsAssociation, Ownable {
    using SafeERC20 for IERC20;

    enum Strategy {
        Arbitrage,
        Liquidation
    }

    ISwapAdapter public immutable swapAdapter;
    IBonzoLendingPool public immutable lendingPool;

    error PnlBelowMinimum(int256 pnl, int256 minPnl);

    event FlashLoanExecuted(Strategy indexed strategy, address indexed asset, uint256 amount, uint256 fee, int256 pnl);

    constructor(address owner_, ISwapAdapter swapAdapter_, IBonzoLendingPool lendingPool_) Ownable(owner_) {
        swapAdapter = swapAdapter_;
        lendingPool = lendingPool_;
    }

    function associate(address token) external onlyOwner {
        _associate(token);
    }

    /// Borrows `amount` of `asset`, swaps along `pathOut` then `pathBack` (which must end in `asset`).
    function flashArbitrage(
        address asset,
        uint256 amount,
        address[] calldata pathOut,
        address[] calldata pathBack,
        int256 minPnl
    ) external onlyOwner {
        _flash(asset, amount, abi.encode(Strategy.Arbitrage, minPnl, abi.encode(pathOut, pathBack)));
    }

    /// Borrows `debtToCover` of `debtAsset`, liquidates `user` on Bonzo for `collateral` (incl. bonus) and
    /// swaps the collateral back along `path` (collateral → … → debtAsset).
    function flashLiquidate(
        address debtAsset,
        uint256 debtToCover,
        address collateral,
        address user,
        address[] calldata path,
        int256 minPnl
    ) external onlyOwner {
        bytes memory data = abi.encode(collateral, user, path);
        _flash(debtAsset, debtToCover, abi.encode(Strategy.Liquidation, minPnl, data));
    }

    /// Borrows `amount` of `asset` and, from the provider's callback, runs `_runStrategy(…, params)`.
    function _flashLoan(address asset, uint256 amount, bytes memory params) internal virtual;

    /// Runs the strategy with the borrowed funds in this contract. On return the contract holds at least
    /// `amount + fee` of `asset` (`owed`) for the provider to take back.
    function _runStrategy(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes memory params
    ) internal returns (uint256 owed) {
        (Strategy strategy, int256 minPnl, bytes memory data) = abi.decode(params, (Strategy, int256, bytes));

        if (strategy == Strategy.Arbitrage) {
            (address[] memory pathOut, address[] memory pathBack) = abi.decode(data, (address[], address[]));
            _swap(amount, pathOut);
            _swap(IERC20(pathOut[pathOut.length - 1]).balanceOf(address(this)), pathBack);
        } else {
            (address collateral, address user, address[] memory path) = abi.decode(data, (address, address, address[]));
            IERC20(asset).forceApprove(address(lendingPool), amount);
            lendingPool.liquidationCall(collateral, asset, user, amount, false);
            _swap(IERC20(collateral).balanceOf(address(this)), path);
        }

        owed = amount + fee;
        int256 pnl = int256(IERC20(asset).balanceOf(address(this))) - int256(owed);
        if (pnl < minPnl) revert PnlBelowMinimum(pnl, minPnl);
        if (pnl < 0) IERC20(asset).safeTransferFrom(owner(), address(this), uint256(-pnl));
        emit FlashLoanExecuted(strategy, asset, amount, fee, pnl);
    }

    function _flash(address asset, uint256 amount, bytes memory params) private {
        _flashLoan(asset, amount, params);
        uint256 profit = IERC20(asset).balanceOf(address(this));
        if (profit > 0) IERC20(asset).safeTransfer(owner(), profit);
    }

    function _swap(uint256 amountIn, address[] memory path) private {
        IERC20(path[0]).forceApprove(address(swapAdapter), amountIn);
        swapAdapter.swap(amountIn, 0, path, address(this), block.timestamp);
    }
}

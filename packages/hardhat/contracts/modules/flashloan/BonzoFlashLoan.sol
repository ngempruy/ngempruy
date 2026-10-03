// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { HtsAssociation } from "../../core/HtsAssociation.sol";
import { ISwapAdapter } from "../../core/ISwapAdapter.sol";

/// Subset of the Bonzo Lend (Aave v2) LendingPool used for flash loans and liquidations.
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

/// Flash-borrows one asset from Bonzo Lend, runs a strategy through ISwapAdapter (SaucerSwap) and repays
/// amount + premium (0.09% on testnet) in the same transaction.
///
/// `minPnl` bounds the result in the borrowed asset: positive = required profit, negative = the most the
/// owner is willing to pay (pulled from the owner, who must approve this contract). The legs swap with
/// no per-leg minimum because the transaction reverts unless the final PnL clears `minPnl`.
///
/// Hedera: associate every HTS token the strategy touches (`associate`) before use. Bonzo testnet
/// reserves can be empty; someone must `deposit` liquidity before anything can be borrowed.
/// Unaudited, for education and testnet use.
contract BonzoFlashLoan is HtsAssociation, Ownable {
    using SafeERC20 for IERC20;

    enum Strategy {
        Arbitrage,
        Liquidation
    }

    IBonzoLendingPool public immutable pool;
    ISwapAdapter public immutable swapAdapter;

    error NotPool();
    error NotSelfInitiated();
    error PnlBelowMinimum(int256 pnl, int256 minPnl);

    event FlashLoanExecuted(
        Strategy indexed strategy,
        address indexed asset,
        uint256 amount,
        uint256 premium,
        int256 pnl
    );

    constructor(address owner_, IBonzoLendingPool pool_, ISwapAdapter swapAdapter_) Ownable(owner_) {
        pool = pool_;
        swapAdapter = swapAdapter_;
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
        _flashLoan(asset, amount, abi.encode(Strategy.Arbitrage, minPnl, abi.encode(pathOut, pathBack)));
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
        _flashLoan(debtAsset, debtToCover, abi.encode(Strategy.Liquidation, minPnl, data));
    }

    /// Bonzo callback: the borrowed funds are in this contract; leave `amount + premium` approved to the pool.
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(pool)) revert NotPool();
        if (initiator != address(this)) revert NotSelfInitiated();

        (address asset, uint256 amount, uint256 premium) = (assets[0], amounts[0], premiums[0]);
        (Strategy strategy, int256 minPnl, bytes memory data) = abi.decode(params, (Strategy, int256, bytes));

        if (strategy == Strategy.Arbitrage) {
            (address[] memory pathOut, address[] memory pathBack) = abi.decode(data, (address[], address[]));
            _swap(amount, pathOut);
            _swap(IERC20(pathOut[pathOut.length - 1]).balanceOf(address(this)), pathBack);
        } else {
            (address collateral, address user, address[] memory path) = abi.decode(data, (address, address, address[]));
            IERC20(asset).forceApprove(address(pool), amount);
            pool.liquidationCall(collateral, asset, user, amount, false);
            _swap(IERC20(collateral).balanceOf(address(this)), path);
        }

        uint256 owed = amount + premium;
        int256 pnl = int256(IERC20(asset).balanceOf(address(this))) - int256(owed);
        if (pnl < minPnl) revert PnlBelowMinimum(pnl, minPnl);
        if (pnl < 0) IERC20(asset).safeTransferFrom(owner(), address(this), uint256(-pnl));

        IERC20(asset).forceApprove(address(pool), owed);
        emit FlashLoanExecuted(strategy, asset, amount, premium, pnl);
        return true;
    }

    function _flashLoan(address asset, uint256 amount, bytes memory params) private {
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        // mode 0 = repay within the transaction, no debt opened
        pool.flashLoan(address(this), assets, amounts, new uint256[](1), address(this), params, 0);

        uint256 profit = IERC20(asset).balanceOf(address(this));
        if (profit > 0) IERC20(asset).safeTransfer(owner(), profit);
    }

    function _swap(uint256 amountIn, address[] memory path) private {
        IERC20(path[0]).forceApprove(address(swapAdapter), amountIn);
        swapAdapter.swap(amountIn, 0, path, address(this), block.timestamp);
    }
}

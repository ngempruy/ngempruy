// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISwapAdapter } from "../../core/ISwapAdapter.sol";
import { FlashLoanStrategies, IBonzoLendingPool } from "./FlashLoanStrategies.sol";

/// Flash loans from Bonzo Lend (Aave v2 `flashLoan`, 9 bps premium).
/// Status (2026-10-03): the mainnet pool is paused (`LP_IS_PAUSED`) and testnet deposits revert, so the
/// reserves can't be funded. This provider works unchanged once Bonzo is live again; until then use
/// SaucerSwapFlashLoan for a live run.
contract BonzoFlashLoan is FlashLoanStrategies {
    using SafeERC20 for IERC20;

    error NotPool();
    error NotSelfInitiated();

    constructor(
        address owner_,
        IBonzoLendingPool pool_,
        ISwapAdapter swapAdapter_
    ) FlashLoanStrategies(owner_, swapAdapter_, pool_) {}

    /// Bonzo callback: the borrowed funds are in this contract; leave `amount + premium` approved to the pool.
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(lendingPool)) revert NotPool();
        if (initiator != address(this)) revert NotSelfInitiated();

        uint256 owed = _runStrategy(assets[0], amounts[0], premiums[0], params);
        IERC20(assets[0]).forceApprove(address(lendingPool), owed);
        return true;
    }

    function _flashLoan(address asset, uint256 amount, bytes memory params) internal override {
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        // mode 0 = repay within the transaction, no debt opened
        lendingPool.flashLoan(address(this), assets, amounts, new uint256[](1), address(this), params, 0);
    }
}

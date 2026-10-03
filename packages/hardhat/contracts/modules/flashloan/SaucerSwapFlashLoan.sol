// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISwapAdapter } from "../../core/ISwapAdapter.sol";
import { FlashLoanStrategies, IBonzoLendingPool } from "./FlashLoanStrategies.sol";

/// Subset of a SaucerSwap V1 pair (Uniswap V2): `swap` with non-empty `data` is a flash swap that calls
/// `uniswapV2Call` on the recipient before checking the pair is repaid.
interface ISaucerSwapPair {
    function token0() external view returns (address);

    function token1() external view returns (address);

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

/// Flash loans as SaucerSwap V1 flash swaps: borrow from a pair, repay the same token plus 0.3%.
/// The source pair is locked during the loan, so strategy paths must not trade through it.
contract SaucerSwapFlashLoan is FlashLoanStrategies {
    using SafeERC20 for IERC20;

    /// Pair to borrow each asset from, set by the owner.
    mapping(address asset => ISaucerSwapPair) public flashPairs;
    ISaucerSwapPair private activePair;

    error NoFlashPair(address asset);
    error NotActivePair();
    error NotSelfInitiated();

    event FlashPairSet(address indexed asset, address pair);

    constructor(
        address owner_,
        ISwapAdapter swapAdapter_,
        IBonzoLendingPool liquidationPool_
    ) FlashLoanStrategies(owner_, swapAdapter_, liquidationPool_) {}

    function setFlashPair(address asset, ISaucerSwapPair pair) external onlyOwner {
        flashPairs[asset] = pair;
        emit FlashPairSet(asset, address(pair));
    }

    function uniswapV2Call(address sender, uint256 amount0, uint256 amount1, bytes calldata params) external {
        if (msg.sender != address(activePair)) revert NotActivePair();
        if (sender != address(this)) revert NotSelfInitiated();

        (address asset, uint256 amount) = amount0 > 0 ? (activePair.token0(), amount0) : (activePair.token1(), amount1);
        // Uniswap V2 fee: repaying x requires x * 997 >= amount * 1000.
        uint256 fee = (amount * 1000) / 997 + 1 - amount;
        uint256 owed = _runStrategy(asset, amount, fee, params);
        IERC20(asset).safeTransfer(msg.sender, owed);
    }

    function _flashLoan(address asset, uint256 amount, bytes memory params) internal override {
        ISaucerSwapPair pair = flashPairs[asset];
        if (address(pair) == address(0)) revert NoFlashPair(asset);

        activePair = pair;
        bool isToken0 = pair.token0() == asset;
        pair.swap(isToken0 ? amount : 0, isToken0 ? 0 : amount, address(this), params);
        delete activePair;
    }
}

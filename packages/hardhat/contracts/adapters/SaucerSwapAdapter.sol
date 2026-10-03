// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { HtsAssociation } from "../core/HtsAssociation.sol";
import { ISwapAdapter } from "../core/ISwapAdapter.sol";

/// Subset of the SaucerSwap V1 router (a Uniswap V2 fork) used by the adapter.
interface ISaucerSwapRouter {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// ISwapAdapter backed by SaucerSwap V1.
/// Hedera testnet router: 0.0.19264 (0x...4b40). Native HBAR goes through WHBAR (token 0.0.15058).
/// The adapter holds tokens mid-swap, so every HTS token in a path must be associated with it
/// first via `associate`.
contract SaucerSwapAdapter is ISwapAdapter, HtsAssociation, Ownable {
    using SafeERC20 for IERC20;

    ISaucerSwapRouter public immutable router;

    error ZeroAmount();
    error InvalidPath();
    error Expired(uint256 deadline);
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);

    event Swapped(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address to
    );

    constructor(address owner_, ISaucerSwapRouter router_) Ownable(owner_) {
        router = router_;
    }

    /// Associates the adapter with an HTS token. Idempotent.
    function associate(address token) external onlyOwner {
        _associate(token);
    }

    function quote(uint256 amountIn, address[] calldata path) external view returns (uint256) {
        if (path.length < 2) revert InvalidPath();
        uint256[] memory amounts = router.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }

    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (path.length < 2) revert InvalidPath();
        if (block.timestamp > deadline) revert Expired(deadline);

        IERC20 tokenIn = IERC20(path[0]);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenIn.forceApprove(address(router), amountIn);

        // Measure what `to` actually received: HTS custom fees can make it differ from the router's return.
        IERC20 tokenOut = IERC20(path[path.length - 1]);
        uint256 balanceBefore = tokenOut.balanceOf(to);
        router.swapExactTokensForTokens(amountIn, minAmountOut, path, to, deadline);
        amountOut = tokenOut.balanceOf(to) - balanceBefore;
        // The router checks its own figure; this checks the received amount with one error type across adapters.
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        emit Swapped(msg.sender, path[0], path[path.length - 1], amountIn, amountOut, to);
    }
}

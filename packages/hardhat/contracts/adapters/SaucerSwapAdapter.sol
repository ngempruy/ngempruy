// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
contract SaucerSwapAdapter is ISwapAdapter, Ownable {
    using SafeERC20 for IERC20;

    address private constant HTS = address(0x167);
    int64 private constant HTS_SUCCESS = 22;
    int64 private constant HTS_TOKEN_ALREADY_ASSOCIATED = 194;

    ISaucerSwapRouter public immutable router;

    error ZeroAmount();
    error InvalidPath();
    error Expired(uint256 deadline);
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);
    error AssociationFailed(address token, int64 responseCode);

    event TokenAssociated(address indexed token);
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

    /// Associates the adapter with an HTS token through the HTS precompile. Idempotent.
    function associate(address token) external onlyOwner {
        (bool ok, bytes memory result) = HTS.call(
            abi.encodeWithSignature("associateToken(address,address)", address(this), token)
        );
        int64 code = ok && result.length == 32 ? abi.decode(result, (int64)) : int64(-1);
        if (code != HTS_SUCCESS && code != HTS_TOKEN_ALREADY_ASSOCIATED) revert AssociationFailed(token, code);
        emit TokenAssociated(token);
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

        uint256[] memory amounts = router.swapExactTokensForTokens(amountIn, minAmountOut, path, to, deadline);
        amountOut = amounts[amounts.length - 1];
        // The router enforces this too; checking here gives callers one error type across adapters.
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        emit Swapped(msg.sender, path[0], path[path.length - 1], amountIn, amountOut, to);
    }
}

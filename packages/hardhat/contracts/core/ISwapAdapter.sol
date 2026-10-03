// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Provider-agnostic token swap. Implemented by the SaucerSwap adapter; consumed by the
/// payments, RWA and flash loan modules so they never talk to a DEX router directly.
/// `path` lists token addresses from input to output (e.g. [SAUCE, WHBAR, USDC]).
/// HTS tokens must be associated with the adapter and with `to` before swapping.
interface ISwapAdapter {
    /// Expected output for `amountIn` along `path`, before slippage.
    function quote(uint256 amountIn, address[] calldata path) external view returns (uint256 amountOut);

    /// Pulls `amountIn` of `path[0]` from the caller (requires approval) and sends the output to `to`.
    /// Reverts if the output is below `minAmountOut` or `block.timestamp > deadline`.
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}

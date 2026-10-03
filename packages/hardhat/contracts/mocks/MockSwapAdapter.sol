// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISwapAdapter } from "../core/ISwapAdapter.sol";

/// ISwapAdapter test double with a fixed rate per (tokenIn, tokenOut) pair, in basis points.
/// Must hold enough of every output token to pay out.
contract MockSwapAdapter is ISwapAdapter {
    mapping(address tokenIn => mapping(address tokenOut => uint256 bps)) public rateBps;

    function setRate(address tokenIn, address tokenOut, uint256 bps) external {
        rateBps[tokenIn][tokenOut] = bps;
    }

    function quote(uint256 amountIn, address[] calldata path) public view returns (uint256 amountOut) {
        amountOut = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            amountOut = (amountOut * rateBps[path[i - 1]][path[i]]) / 10_000;
        }
    }

    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256 amountOut) {
        amountOut = quote(amountIn, path);
        require(amountOut >= minAmountOut, "slippage");
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).transfer(to, amountOut);
    }
}

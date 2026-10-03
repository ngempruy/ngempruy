// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV2Callee {
    function uniswapV2Call(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external;
}

/// Uniswap V2 pair test double for flash swaps: pays out, calls back, then requires the borrowed token
/// back with the 0.3% fee (amountIn * 997 >= amountOut * 1000). Holds its own reserves.
contract MockSaucerSwapPair {
    address public immutable token0;
    address public immutable token1;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external {
        IERC20 token = IERC20(amount0Out > 0 ? token0 : token1);
        uint256 amountOut = amount0Out + amount1Out;
        uint256 balanceBefore = token.balanceOf(address(this));

        token.transfer(to, amountOut);
        IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);

        uint256 amountIn = token.balanceOf(address(this)) + amountOut - balanceBefore;
        require(amountIn * 997 >= amountOut * 1000, "K");
    }
}

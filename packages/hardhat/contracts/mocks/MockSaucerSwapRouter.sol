// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Test double for the SaucerSwap V1 router: every hop pays `rateBps` / 10_000 of its input.
/// Must hold enough of the output token to pay out.
contract MockSaucerSwapRouter {
    uint256 public rateBps = 10_000;

    function setRateBps(uint256 rateBps_) external {
        rateBps = rateBps_;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) public view returns (uint256[] memory amounts) {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            amounts[i] = (amounts[i - 1] * rateBps) / 10_000;
        }
    }

    /// Skips the min-output check on purpose so the adapter's own check is what tests exercise.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).transfer(to, amounts[amounts.length - 1]);
    }
}

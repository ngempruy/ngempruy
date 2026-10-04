// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { HtsAssociation } from "../../core/HtsAssociation.sol";
import { ISwapAdapter } from "../../core/ISwapAdapter.sol";

/// @title SwapCheckout (recipe dex+payments)
/// @notice Pay a USDC price with any token that has a route to USDC. The payer's token is swapped through
/// ISwapAdapter, the merchant receives exactly `price` and any surplus USDC goes back to the payer.
/// Merchants match payments to orders by the `Paid` event's `orderId`.
/// Hedera: the merchant must be associated with USDC, and so must the payer when a refund is possible.
contract SwapCheckout is HtsAssociation {
    using SafeERC20 for IERC20;

    ISwapAdapter public immutable adapter;
    IERC20 public immutable usdc;

    error ZeroPrice();
    error PathMustEndInUsdc();

    event Paid(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed merchant,
        address tokenIn,
        uint256 amountIn,
        uint256 price,
        uint256 refund
    );

    constructor(ISwapAdapter adapter_, IERC20 usdc_) {
        adapter = adapter_;
        usdc = usdc_;
    }

    /// The contract holds the payer's token and USDC mid-payment, so each must be associated once.
    /// Idempotent and grants nothing, so anyone may call it.
    function associate(address token) external {
        _associate(token);
    }

    /// Swaps `amountIn` of `path[0]` to USDC and pays `price` to `merchant`, refunding the surplus.
    /// Reverts (via the adapter) if the swap yields less than `price`. With `path = [usdc]` the price is
    /// transferred directly and `amountIn` / `deadline` are ignored.
    function pay(
        bytes32 orderId,
        address merchant,
        uint256 price,
        address[] calldata path,
        uint256 amountIn,
        uint256 deadline
    ) external returns (uint256 refund) {
        if (price == 0) revert ZeroPrice();
        if (path.length == 0 || path[path.length - 1] != address(usdc)) revert PathMustEndInUsdc();

        if (path.length == 1) {
            usdc.safeTransferFrom(msg.sender, merchant, price);
            emit Paid(orderId, msg.sender, merchant, address(usdc), price, price, 0);
            return 0;
        }

        IERC20 tokenIn = IERC20(path[0]);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenIn.forceApprove(address(adapter), amountIn);
        uint256 received = adapter.swap(amountIn, price, path, address(this), deadline);

        refund = received - price;
        usdc.safeTransfer(merchant, price);
        if (refund > 0) usdc.safeTransfer(msg.sender, refund);
        emit Paid(orderId, msg.sender, merchant, address(tokenIn), amountIn, price, refund);
    }
}

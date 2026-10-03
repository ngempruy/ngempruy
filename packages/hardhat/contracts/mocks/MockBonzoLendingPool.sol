// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/// Aave v2-style LendingPool test double: single-asset flash loans at 9 bps, and a liquidation that
/// pays `collateralPerDebtBps` of collateral per unit of debt covered. Holds the liquidity itself.
contract MockBonzoLendingPool {
    uint256 public constant PREMIUM_BPS = 9;
    uint256 public collateralPerDebtBps = 10_500;

    function setCollateralPerDebtBps(uint256 bps) external {
        collateralPerDebtBps = bps;
    }

    function flashLoan(
        address receiver,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata,
        address,
        bytes calldata params,
        uint16
    ) external {
        uint256[] memory premiums = new uint256[](1);
        premiums[0] = (amounts[0] * PREMIUM_BPS) / 10_000;
        IERC20(assets[0]).transfer(receiver, amounts[0]);
        require(
            IFlashLoanReceiver(receiver).executeOperation(assets, amounts, premiums, msg.sender, params),
            "invalid executor return"
        );
        IERC20(assets[0]).transferFrom(receiver, address(this), amounts[0] + premiums[0]);
    }

    function liquidationCall(address collateral, address debt, address, uint256 debtToCover, bool) external {
        IERC20(debt).transferFrom(msg.sender, address(this), debtToCover);
        IERC20(collateral).transfer(msg.sender, (debtToCover * collateralPerDebtBps) / 10_000);
    }
}

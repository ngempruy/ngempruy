// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IHederaTokenService } from "../interfaces/IHederaTokenService.sol";

/// Minimal stand-in for the HTS system contract, installed at 0x167 with hardhat_setCode.
/// The hedera-forking emulator has no KYC support, so unit tests use this; the real
/// behaviour is exercised on testnet by the deploy and demo scripts.
contract MockHts {
    int64 internal constant SUCCESS = 22;
    int64 internal constant ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN = 176;
    int64 internal constant TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 184;
    int64 internal constant INSUFFICIENT_TOKEN_BALANCE = 178;

    uint160 public tokenCount;
    mapping(address => mapping(address => bool)) public kyc;
    mapping(address => mapping(address => bool)) public associated;
    mapping(address => mapping(address => int64)) public balance;
    mapping(address => address) public treasuryOf;

    function createFungibleToken(
        IHederaTokenService.HederaToken memory token,
        int64,
        int32
    ) external payable returns (int64, address created) {
        created = address(0x1000 + ++tokenCount);
        treasuryOf[created] = token.treasury;
        associated[created][token.treasury] = true;
        kyc[created][token.treasury] = true;
        return (SUCCESS, created);
    }

    function mintToken(address token, int64 amount, bytes[] memory) external returns (int64, int64, int64[] memory) {
        balance[token][treasuryOf[token]] += amount;
        return (SUCCESS, 0, new int64[](0));
    }

    function transferToken(address token, address sender, address recipient, int64 amount) external returns (int64) {
        if (!associated[token][recipient]) return TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        if (!kyc[token][recipient]) return ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN;
        if (balance[token][sender] < amount) return INSUFFICIENT_TOKEN_BALANCE;
        balance[token][sender] -= amount;
        balance[token][recipient] += amount;
        return SUCCESS;
    }

    function grantTokenKyc(address token, address account) external returns (int64) {
        if (!associated[token][account]) return TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        kyc[token][account] = true;
        return SUCCESS;
    }

    function revokeTokenKyc(address token, address account) external returns (int64) {
        kyc[token][account] = false;
        return SUCCESS;
    }

    function isKyc(address token, address account) external view returns (int64, bool) {
        return (SUCCESS, kyc[token][account]);
    }

    /// Test helper: what an account's HIP-719 `associate()` call does on the real network.
    function setAssociated(address token, address account) external {
        associated[token][account] = true;
    }
}

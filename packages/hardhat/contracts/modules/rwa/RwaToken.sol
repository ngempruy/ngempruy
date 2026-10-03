// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IHederaTokenService } from "../../interfaces/IHederaTokenService.sol";

/// @title RwaToken
/// @notice Issues shares of a real-world asset as a native HTS fungible token with a KYC key.
/// This contract is the token's treasury, KYC key and supply key, so every compliance action
/// is an on-chain role check here followed by an HTS system-contract call. No issuer key
/// has to live on a server.
contract RwaToken is AccessControl {
    address internal constant HTS = address(0x167);
    int64 internal constant SUCCESS = 22;
    uint256 internal constant KYC_KEY = 2;
    uint256 internal constant SUPPLY_KEY = 16;
    int64 internal constant AUTO_RENEW_PERIOD = 7_890_000; // ~91 days, the HTS minimum

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    /// The HTS token, set once by createToken.
    address public token;

    event TokenCreated(address indexed token, string name, string symbol, uint8 decimals);
    event KycGranted(address indexed account);
    event KycRevoked(address indexed account);
    event Issued(address indexed to, uint256 amount);

    error TokenAlreadyCreated();
    error TokenNotCreated();
    error ZeroAmount();
    error AmountTooLarge(uint256 amount);
    error KycRequired(address account);
    /// An HTS system-contract call returned a non-SUCCESS code, e.g. 184 when the
    /// recipient is not associated with the token.
    error HtsCallFailed(bytes4 operation, int64 responseCode);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
    }

    /// Creates the HTS token with zero supply. msg.value pays the HTS creation fee (in weibars).
    function createToken(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        string calldata memo
    ) external payable onlyRole(ISSUER_ROLE) returns (address created) {
        if (token != address(0)) revert TokenAlreadyCreated();

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey({
            keyType: KYC_KEY | SUPPLY_KEY,
            key: IHederaTokenService.KeyValue({
                inheritAccountKey: false,
                contractId: address(this),
                ed25519: "",
                ECDSA_secp256k1: "",
                delegatableContractId: address(0)
            })
        });
        IHederaTokenService.HederaToken memory spec = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: address(this),
            memo: memo,
            tokenSupplyType: false,
            maxSupply: 0,
            freezeDefault: false,
            tokenKeys: keys,
            expiry: IHederaTokenService.Expiry({
                second: 0,
                autoRenewAccount: address(this),
                autoRenewPeriod: AUTO_RENEW_PERIOD
            })
        });

        int64 responseCode;
        (responseCode, created) = IHederaTokenService(HTS).createFungibleToken{ value: msg.value }(
            spec,
            0,
            int32(uint32(decimals))
        );
        _check(IHederaTokenService.createFungibleToken.selector, responseCode);
        token = created;
        emit TokenCreated(created, name, symbol, decimals);
    }

    function grantKyc(address account) external onlyRole(COMPLIANCE_ROLE) {
        _check(IHederaTokenService.grantTokenKyc.selector, IHederaTokenService(HTS).grantTokenKyc(_token(), account));
        emit KycGranted(account);
    }

    function revokeKyc(address account) external onlyRole(COMPLIANCE_ROLE) {
        _check(IHederaTokenService.revokeTokenKyc.selector, IHederaTokenService(HTS).revokeTokenKyc(_token(), account));
        emit KycRevoked(account);
    }

    /// Mints `amount` (smallest units) and sends it to a KYC'd investor. The investor must be
    /// associated with the token (or have a free auto-association slot).
    function issue(address to, uint256 amount) external onlyRole(ISSUER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (amount > uint64(type(int64).max)) revert AmountTooLarge(amount);
        address t = _token();
        IHederaTokenService hts = IHederaTokenService(HTS);

        (int64 kycCode, bool kyc) = hts.isKyc(t, to);
        _check(IHederaTokenService.isKyc.selector, kycCode);
        if (!kyc) revert KycRequired(to);

        int64 units = int64(uint64(amount));
        (int64 mintCode, , ) = hts.mintToken(t, units, new bytes[](0));
        _check(IHederaTokenService.mintToken.selector, mintCode);
        _check(IHederaTokenService.transferToken.selector, hts.transferToken(t, address(this), to, units));
        emit Issued(to, amount);
    }

    function _token() internal view returns (address t) {
        t = token;
        if (t == address(0)) revert TokenNotCreated();
    }

    function _check(bytes4 operation, int64 responseCode) internal pure {
        if (responseCode != SUCCESS) revert HtsCallFailed(operation, responseCode);
    }
}

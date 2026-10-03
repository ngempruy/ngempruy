// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Lets a contract associate itself with HTS tokens, which Hedera requires before it can hold them.
abstract contract HtsAssociation {
    address private constant HTS = address(0x167);
    int64 private constant HTS_SUCCESS = 22;
    int64 private constant HTS_TOKEN_ALREADY_ASSOCIATED = 194;

    error AssociationFailed(address token, int64 responseCode);

    event TokenAssociated(address indexed token);

    /// Idempotent: an existing association counts as success.
    function _associate(address token) internal {
        (bool ok, bytes memory result) = HTS.call(
            abi.encodeWithSignature("associateToken(address,address)", address(this), token)
        );
        int64 code = ok && result.length == 32 ? abi.decode(result, (int64)) : int64(-1);
        if (code != HTS_SUCCESS && code != HTS_TOKEN_ALREADY_ASSOCIATED) revert AssociationFailed(token, code);
        emit TokenAssociated(token);
    }
}

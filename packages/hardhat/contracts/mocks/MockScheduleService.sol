// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// HIP-1215 Schedule Service test double, installed at 0x16b with hardhat_setCode. Records each
/// scheduled call; tests run one with `execute`, playing the network at its expiry second.
contract MockScheduleService {
    struct Scheduled {
        address to;
        uint256 expirySecond;
        uint256 gasLimit;
        bytes callData;
    }

    Scheduled[] public scheduled;
    bool public busy;

    function setBusy(bool busy_) external {
        busy = busy_;
    }

    function count() external view returns (uint256) {
        return scheduled.length;
    }

    function hasScheduleCapacity(uint256 expirySecond, uint256) external view returns (bool) {
        return !busy && expirySecond > block.timestamp;
    }

    function scheduleCall(
        address to,
        uint256 expirySecond,
        uint256 gasLimit,
        uint64,
        bytes memory callData
    ) external returns (int64, address) {
        if (busy) return (int64(366), address(0)); // SCHEDULE_EXPIRY_IS_BUSY
        scheduled.push(Scheduled(to, expirySecond, gasLimit, callData));
        return (int64(22), address(uint160(0x1000 + scheduled.length)));
    }

    function execute(uint256 index) external {
        Scheduled memory s = scheduled[index];
        (bool ok, bytes memory ret) = s.to.call{ gas: s.gasLimit }(s.callData);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}

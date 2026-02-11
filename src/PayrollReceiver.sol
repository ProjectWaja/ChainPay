// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { CrossChainPayrollMessage, CrossChainPayrollReceived } from "./ICrosschainDisbursement.sol";

/// @notice Audit record for a cross-chain disbursement
struct DisbursementRecord {
    bytes32 messageId;
    uint64 sourceChainSelector;
    bytes32 employeeId;
    address employee;
    uint256 salaryAmount;
    address paymentToken;
    uint256 timestamp;
}

/// @title PayrollReceiver — CCIP Receiver for cross-chain payroll
/// @notice Receives CCIP messages and auto-distributes payment tokens to employees
contract PayrollReceiver is CCIPReceiver, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Authorized sender contract on the source chain
    address public authorizedSender;

    /// @notice Authorized source chain selector
    uint64 public sourceChainSelector;

    /// @notice Disbursement audit trail
    DisbursementRecord[] public disbursements;

    error UnauthorizedSourceChain(uint64 chainSelector);
    error UnauthorizedSender(address sender);
    error ZeroAddress();

    constructor(
        address _router,
        address _owner,
        address _authorizedSender,
        uint64 _sourceChainSelector
    ) CCIPReceiver(_router) Ownable(_owner) {
        authorizedSender = _authorizedSender;
        sourceChainSelector = _sourceChainSelector;
    }

    /// @notice Process incoming CCIP message and distribute payment
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (message.sourceChainSelector != sourceChainSelector) {
            revert UnauthorizedSourceChain(message.sourceChainSelector);
        }

        address sender = abi.decode(message.sender, (address));
        if (sender != authorizedSender) {
            revert UnauthorizedSender(sender);
        }

        CrossChainPayrollMessage memory payload = abi.decode(message.data, (CrossChainPayrollMessage));

        // Auto-distribute payment token to employee
        IERC20(payload.paymentToken).safeTransfer(payload.employee, payload.salaryAmount);

        // Record for audit trail
        disbursements.push(
            DisbursementRecord({
                messageId: message.messageId,
                sourceChainSelector: message.sourceChainSelector,
                employeeId: payload.employeeId,
                employee: payload.employee,
                salaryAmount: payload.salaryAmount,
                paymentToken: payload.paymentToken,
                timestamp: block.timestamp
            })
        );

        emit CrossChainPayrollReceived(
            message.messageId,
            message.sourceChainSelector,
            payload.employeeId,
            payload.employee,
            payload.salaryAmount
        );
    }

    /// @notice Update the authorized sender contract
    function setAuthorizedSender(address _authorizedSender) external onlyOwner {
        if (_authorizedSender == address(0)) revert ZeroAddress();
        authorizedSender = _authorizedSender;
    }

    /// @notice Update the authorized source chain selector
    function setSourceChainSelector(uint64 _sourceChainSelector) external onlyOwner {
        sourceChainSelector = _sourceChainSelector;
    }

    /// @notice Emergency withdraw tokens (e.g., if receiver is decommissioned)
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Get the total number of disbursements processed
    function getDisbursementCount() external view returns (uint256) {
        return disbursements.length;
    }

    /// @notice Get paginated disbursement records
    function getDisbursements(uint256 offset, uint256 limit) external view returns (DisbursementRecord[] memory) {
        if (offset >= disbursements.length) {
            return new DisbursementRecord[](0);
        }
        uint256 end = offset + limit;
        if (end > disbursements.length) {
            end = disbursements.length;
        }
        uint256 size = end - offset;
        DisbursementRecord[] memory page = new DisbursementRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = disbursements[offset + i];
        }
        return page;
    }

    /// @notice Get balance of a specific token held by this contract
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}

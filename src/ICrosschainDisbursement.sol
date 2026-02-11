// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Payload sent via CCIP to instruct the receiver to pay an employee
struct CrossChainPayrollMessage {
    bytes32 employeeId;
    address employee;
    uint256 salaryAmount;
    address paymentToken;
}

/// @notice Emitted on the source chain when a cross-chain disbursement is sent
event CrossChainDisbursementSent(
    bytes32 indexed messageId,
    uint64 indexed destinationChainSelector,
    bytes32 indexed employeeId,
    address employee,
    uint256 salaryAmount
);

/// @notice Emitted on the destination chain when a cross-chain payroll is received
event CrossChainPayrollReceived(
    bytes32 indexed messageId,
    uint64 indexed sourceChainSelector,
    bytes32 indexed employeeId,
    address employee,
    uint256 salaryAmount
);

/// @notice Interface for the CCIP sender module
interface ICrossChainDisbursement {
    /// @notice Send a cross-chain payroll disbursement via CCIP
    /// @param destinationChainSelector The CCIP chain selector for the destination chain
    /// @param employeeId Unique identifier for the employee
    /// @param employee The employee's address on the destination chain
    /// @param salaryAmount The salary amount in payment token decimals
    /// @param paymentToken The payment token address on the destination chain
    /// @return messageId The CCIP message ID
    function sendDisbursement(
        uint64 destinationChainSelector,
        bytes32 employeeId,
        address employee,
        uint256 salaryAmount,
        address paymentToken
    ) external payable returns (bytes32 messageId);

    /// @notice Estimate the CCIP fee for a cross-chain disbursement
    /// @param destinationChainSelector The CCIP chain selector for the destination chain
    /// @param employeeId Unique identifier for the employee
    /// @param employee The employee's address on the destination chain
    /// @param salaryAmount The salary amount in payment token decimals
    /// @param paymentToken The payment token address on the destination chain
    /// @return fee The estimated fee in native gas
    function estimateFee(
        uint64 destinationChainSelector,
        bytes32 employeeId,
        address employee,
        uint256 salaryAmount,
        address paymentToken
    ) external view returns (uint256 fee);
}

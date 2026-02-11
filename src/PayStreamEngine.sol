// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title PayStream Protocol — Privacy-Preserving Onchain Payroll
/// @author PayStream Team
/// @notice Core payroll engine powered by Chainlink CCIP, Data Feeds, and Automation
/// @dev Hackathon submission for Chainlink Feb 2026

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ICrossChainDisbursement } from "./ICrosschainDisbursement.sol";

/// @notice Payroll configuration for an employee
struct PayrollRecord {
    address employee;
    uint256 salaryAmount; // in payment token decimals
    uint64 payFrequency; // seconds between payments (e.g., 2 weeks = 1_209_600)
    uint64 lastPaidAt;
    uint64 startDate;
    bool active;
    uint64 destinationChainSelector; // 0 = same chain, otherwise CCIP chain selector
}

/// @notice Emitted when a payroll run is executed
event PayrollExecuted(uint256 indexed runId, uint256 employeesPaid, uint256 totalDisbursed);

/// @notice Emitted when an employee is added
event EmployeeAdded(bytes32 indexed employeeId, address indexed employee);

/// @notice Emitted when an employee is removed
event EmployeeRemoved(bytes32 indexed employeeId);

/// @notice Emitted when a cross-chain payment is initiated via CCIP
event CrossChainPaymentInitiated(
    bytes32 indexed messageId,
    bytes32 indexed employeeId,
    uint64 destinationChainSelector,
    uint256 salaryAmount
);

/// @notice Emitted when an individual employee is paid during a payroll run
event EmployeePaid(bytes32 indexed employeeId, address indexed employee, uint256 amount);

/// @notice Emitted when the cross-chain module is updated
event CrossChainModuleUpdated(address indexed newModule);

/// @notice Emitted when an employee's salary is updated
event EmployeeSalaryUpdated(bytes32 indexed employeeId, uint256 newSalary);

/// @notice Emitted when an employee's destination chain is updated
event EmployeeChainUpdated(bytes32 indexed employeeId, uint64 newChainSelector);

contract PayStreamEngine is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant PAYROLL_ADMIN_ROLE = keccak256("PAYROLL_ADMIN_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    IERC20 public immutable paymentToken;

    ICrossChainDisbursement public crossChainModule;

    mapping(bytes32 => PayrollRecord) public payroll;
    bytes32[] public employeeIds;

    uint256 public totalPayrollRuns;

    error EmployeeAlreadyExists(bytes32 employeeId);
    error EmployeeNotFound(bytes32 employeeId);
    error InsufficientBalance(uint256 required, uint256 available);
    error PaymentNotDue(bytes32 employeeId, uint64 nextPaymentAt);
    error CrossChainModuleNotSet();

    constructor(address _paymentToken, address _admin) {
        paymentToken = IERC20(_paymentToken);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAYROLL_ADMIN_ROLE, _admin);
    }

    /// @notice Add an employee to the payroll
    function addEmployee(
        bytes32 employeeId,
        address employee,
        uint256 salaryAmount,
        uint64 payFrequency,
        uint64 startDate,
        uint64 destinationChainSelector
    ) external onlyRole(PAYROLL_ADMIN_ROLE) {
        if (payroll[employeeId].employee != address(0)) {
            revert EmployeeAlreadyExists(employeeId);
        }

        payroll[employeeId] = PayrollRecord({
            employee: employee,
            salaryAmount: salaryAmount,
            payFrequency: payFrequency,
            lastPaidAt: startDate,
            startDate: startDate,
            active: true,
            destinationChainSelector: destinationChainSelector
        });

        employeeIds.push(employeeId);
        emit EmployeeAdded(employeeId, employee);
    }

    /// @notice Remove an employee from payroll
    function removeEmployee(bytes32 employeeId) external onlyRole(PAYROLL_ADMIN_ROLE) {
        if (payroll[employeeId].employee == address(0)) {
            revert EmployeeNotFound(employeeId);
        }
        payroll[employeeId].active = false;
        emit EmployeeRemoved(employeeId);
    }

    /// @notice Chainlink Automation compatible — check if any employees are due for payment
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        bytes32[] memory dueEmployees = new bytes32[](employeeIds.length);
        uint256 count;

        for (uint256 i = 0; i < employeeIds.length; i++) {
            PayrollRecord storage record = payroll[employeeIds[i]];
            if (record.active && block.timestamp >= record.lastPaidAt + record.payFrequency) {
                dueEmployees[count] = employeeIds[i];
                count++;
            }
        }

        if (count > 0) {
            // Trim array to actual size
            bytes32[] memory trimmed = new bytes32[](count);
            for (uint256 i = 0; i < count; i++) {
                trimmed[i] = dueEmployees[i];
            }
            upkeepNeeded = true;
            performData = abi.encode(trimmed);
        }
    }

    /// @notice Chainlink Automation compatible — execute payroll for due employees
    function performUpkeep(bytes calldata performData) external onlyRole(AUTOMATION_ROLE) {
        bytes32[] memory dueEmployees = abi.decode(performData, (bytes32[]));
        uint256 totalDisbursed;

        for (uint256 i = 0; i < dueEmployees.length; i++) {
            PayrollRecord storage record = payroll[dueEmployees[i]];

            if (!record.active) continue;
            if (block.timestamp < record.lastPaidAt + record.payFrequency) {
                revert PaymentNotDue(dueEmployees[i], record.lastPaidAt + record.payFrequency);
            }

            if (record.destinationChainSelector == 0) {
                // Same-chain payment
                paymentToken.safeTransfer(record.employee, record.salaryAmount);
            } else {
                // Cross-chain payment via CCIP
                if (address(crossChainModule) == address(0)) revert CrossChainModuleNotSet();

                // Transfer salary to disbursement module as escrow
                paymentToken.safeTransfer(address(crossChainModule), record.salaryAmount);

                // Estimate fee and send cross-chain message
                uint256 fee = crossChainModule.estimateFee(
                    record.destinationChainSelector,
                    dueEmployees[i],
                    record.employee,
                    record.salaryAmount,
                    address(paymentToken)
                );

                bytes32 messageId = crossChainModule.sendDisbursement{ value: fee }(
                    record.destinationChainSelector,
                    dueEmployees[i],
                    record.employee,
                    record.salaryAmount,
                    address(paymentToken)
                );

                emit CrossChainPaymentInitiated(
                    messageId, dueEmployees[i], record.destinationChainSelector, record.salaryAmount
                );
            }

            record.lastPaidAt = uint64(block.timestamp);
            totalDisbursed += record.salaryAmount;
            emit EmployeePaid(dueEmployees[i], record.employee, record.salaryAmount);
        }

        totalPayrollRuns++;
        emit PayrollExecuted(totalPayrollRuns, dueEmployees.length, totalDisbursed);
    }

    /// @notice Get the number of employees on payroll
    function getEmployeeCount() external view returns (uint256) {
        return employeeIds.length;
    }

    /// @notice Check when an employee's next payment is due
    function getNextPaymentDue(bytes32 employeeId) external view returns (uint64) {
        PayrollRecord storage record = payroll[employeeId];
        if (record.employee == address(0)) revert EmployeeNotFound(employeeId);
        return record.lastPaidAt + record.payFrequency;
    }

    /// @notice Set the cross-chain disbursement module
    function setCrossChainModule(address _module) external onlyRole(DEFAULT_ADMIN_ROLE) {
        crossChainModule = ICrossChainDisbursement(_module);
        emit CrossChainModuleUpdated(_module);
    }

    /// @notice Get all employee IDs
    function getAllEmployeeIds() external view returns (bytes32[] memory) {
        return employeeIds;
    }

    /// @notice Get the engine's payment token balance
    function getEngineBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

    /// @notice Get all employee IDs that are currently due for payment
    function getPaymentsDueNow() external view returns (bytes32[] memory) {
        bytes32[] memory dueEmployees = new bytes32[](employeeIds.length);
        uint256 count;

        for (uint256 i = 0; i < employeeIds.length; i++) {
            PayrollRecord storage record = payroll[employeeIds[i]];
            if (record.active && block.timestamp >= record.lastPaidAt + record.payFrequency) {
                dueEmployees[count] = employeeIds[i];
                count++;
            }
        }

        bytes32[] memory trimmed = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            trimmed[i] = dueEmployees[i];
        }
        return trimmed;
    }

    /// @notice Update an employee's salary
    function updateEmployeeSalary(bytes32 employeeId, uint256 newSalary) external onlyRole(PAYROLL_ADMIN_ROLE) {
        if (payroll[employeeId].employee == address(0)) revert EmployeeNotFound(employeeId);
        payroll[employeeId].salaryAmount = newSalary;
        emit EmployeeSalaryUpdated(employeeId, newSalary);
    }

    /// @notice Update an employee's destination chain selector
    function updateEmployeeChain(bytes32 employeeId, uint64 newChainSelector) external onlyRole(PAYROLL_ADMIN_ROLE) {
        if (payroll[employeeId].employee == address(0)) revert EmployeeNotFound(employeeId);
        payroll[employeeId].destinationChainSelector = newChainSelector;
        emit EmployeeChainUpdated(employeeId, newChainSelector);
    }

    /// @notice Accept ETH for CCIP fees
    receive() external payable { }
}

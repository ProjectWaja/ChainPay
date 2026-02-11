// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {
    ICrossChainDisbursement,
    CrossChainPayrollMessage,
    CrossChainDisbursementSent
} from "./ICrosschainDisbursement.sol";

/// @title CrossChainDisbursement — CCIP Sender for cross-chain payroll
/// @notice Sends data-only CCIP messages instructing destination-chain receivers to pay employees
contract CrossChainDisbursement is ICrossChainDisbursement, AccessControl {
    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE_ROLE");

    IRouterClient public immutable router;

    /// @notice Mapping of destination chain selector => authorized receiver contract on that chain
    mapping(uint64 => address) public receivers;

    error ReceiverNotSet(uint64 chainSelector);
    error InsufficientFee(uint256 required, uint256 provided);

    constructor(address _router, address _admin) {
        router = IRouterClient(_router);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    /// @notice Set the authorized receiver contract for a destination chain
    function setReceiver(uint64 chainSelector, address receiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        receivers[chainSelector] = receiver;
    }

    /// @inheritdoc ICrossChainDisbursement
    function sendDisbursement(
        uint64 destinationChainSelector,
        bytes32 employeeId,
        address employee,
        uint256 salaryAmount,
        address paymentToken
    ) external payable onlyRole(ENGINE_ROLE) returns (bytes32 messageId) {
        address receiver = receivers[destinationChainSelector];
        if (receiver == address(0)) revert ReceiverNotSet(destinationChainSelector);

        Client.EVM2AnyMessage memory message = _buildMessage(
            receiver, employeeId, employee, salaryAmount, paymentToken
        );

        uint256 fee = router.getFee(destinationChainSelector, message);
        if (msg.value < fee) revert InsufficientFee(fee, msg.value);

        messageId = router.ccipSend{ value: fee }(destinationChainSelector, message);

        // Refund excess ETH
        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool ok,) = msg.sender.call{ value: excess }("");
            require(ok, "Refund failed");
        }

        emit CrossChainDisbursementSent(messageId, destinationChainSelector, employeeId, employee, salaryAmount);
    }

    /// @inheritdoc ICrossChainDisbursement
    function estimateFee(
        uint64 destinationChainSelector,
        bytes32 employeeId,
        address employee,
        uint256 salaryAmount,
        address paymentToken
    ) external view returns (uint256 fee) {
        address receiver = receivers[destinationChainSelector];
        if (receiver == address(0)) revert ReceiverNotSet(destinationChainSelector);

        Client.EVM2AnyMessage memory message = _buildMessage(
            receiver, employeeId, employee, salaryAmount, paymentToken
        );

        fee = router.getFee(destinationChainSelector, message);
    }

    function _buildMessage(
        address receiver,
        bytes32 employeeId,
        address employee,
        uint256 salaryAmount,
        address paymentToken
    ) internal pure returns (Client.EVM2AnyMessage memory) {
        CrossChainPayrollMessage memory payload = CrossChainPayrollMessage({
            employeeId: employeeId,
            employee: employee,
            salaryAmount: salaryAmount,
            paymentToken: paymentToken
        });

        return Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: abi.encode(payload),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({ gasLimit: 500_000, allowOutOfOrderExecution: true })
            ),
            feeToken: address(0) // Pay in native gas
        });
    }

    /// @notice Accept ETH for CCIP fees
    receive() external payable { }
}

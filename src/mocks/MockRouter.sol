// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @title MockRouter — Minimal CCIP router for Anvil deployments
/// @notice Returns 0 fee, emits event on send, always supports chains
contract MockRouter is IRouterClient {
    uint256 private _nonce;

    event MockCCIPSend(uint64 indexed destinationChainSelector, bytes32 messageId);

    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return 0;
    }

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata)
        external
        payable
        returns (bytes32 messageId)
    {
        _nonce++;
        messageId = keccak256(abi.encodePacked(block.timestamp, msg.sender, _nonce));
        emit MockCCIPSend(destinationChainSelector, messageId);
    }

    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }

    /// @notice Required by IERC165
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IRouterClient).interfaceId || interfaceId == 0x01ffc9a7;
    }
}

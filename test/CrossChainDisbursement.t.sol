// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { CrossChainDisbursement } from "../src/CrossChainDisbursement.sol";
import { CrossChainDisbursementSent } from "../src/ICrosschainDisbursement.sol";
import { CCIPLocalSimulator } from "@chainlink/local/src/ccip/CCIPLocalSimulator.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC_CC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 10_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract CrossChainDisbursementTest is Test {
    CrossChainDisbursement public disbursement;
    CCIPLocalSimulator public simulator;
    MockUSDC_CC public usdc;

    address public admin = makeAddr("admin");
    address public engine = makeAddr("engine");
    address public receiver = makeAddr("receiver");
    address public alice = makeAddr("alice");

    uint64 public chainSelector;
    IRouterClient public sourceRouter;

    bytes32 public aliceId = keccak256("alice-001");
    uint256 public constant SALARY = 5_000e6;

    function setUp() public {
        simulator = new CCIPLocalSimulator();

        (
            uint64 chainSelector_,
            IRouterClient sourceRouter_,
            ,
            ,
            ,
            ,
        ) = simulator.configuration();
        chainSelector = chainSelector_;
        sourceRouter = sourceRouter_;

        vm.startPrank(admin);
        usdc = new MockUSDC_CC();
        disbursement = new CrossChainDisbursement(address(sourceRouter), admin);
        disbursement.grantRole(disbursement.ENGINE_ROLE(), engine);
        disbursement.setReceiver(chainSelector, receiver);
        vm.stopPrank();
    }

    function test_deployment() public view {
        assertEq(address(disbursement.router()), address(sourceRouter));
        assertTrue(disbursement.hasRole(disbursement.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_setReceiver() public view {
        assertEq(disbursement.receivers(chainSelector), receiver);
    }

    function test_setReceiver_revertsNonAdmin() public {
        vm.prank(engine);
        vm.expectRevert();
        disbursement.setReceiver(chainSelector, address(0x123));
    }

    function test_sendDisbursement_success() public {
        vm.prank(engine);
        bytes32 messageId = disbursement.sendDisbursement(
            chainSelector, aliceId, alice, SALARY, address(usdc)
        );
        assertTrue(messageId != bytes32(0));
    }

    function test_sendDisbursement_emitsEvent() public {
        vm.prank(engine);
        vm.expectEmit(false, true, true, true);
        emit CrossChainDisbursementSent(bytes32(0), chainSelector, aliceId, alice, SALARY);
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
    }

    function test_sendDisbursement_revertsNoReceiver() public {
        uint64 unknownChain = 99;
        vm.prank(engine);
        vm.expectRevert(abi.encodeWithSelector(CrossChainDisbursement.ReceiverNotSet.selector, unknownChain));
        disbursement.sendDisbursement(unknownChain, aliceId, alice, SALARY, address(usdc));
    }

    function test_sendDisbursement_revertsUnauthorized() public {
        vm.prank(alice); // Not engine
        vm.expectRevert();
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
    }

    function test_estimateFee() public view {
        // MockCCIPRouter returns 0 fee by default
        uint256 fee = disbursement.estimateFee(chainSelector, aliceId, alice, SALARY, address(usdc));
        assertEq(fee, 0);
    }

    function test_estimateFee_revertsNoReceiver() public {
        uint64 unknownChain = 99;
        vm.expectRevert(abi.encodeWithSelector(CrossChainDisbursement.ReceiverNotSet.selector, unknownChain));
        disbursement.estimateFee(unknownChain, aliceId, alice, SALARY, address(usdc));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { PayrollReceiver, DisbursementRecord } from "../src/PayrollReceiver.sol";
import { CrossChainDisbursement } from "../src/CrossChainDisbursement.sol";
import { CrossChainPayrollMessage, CrossChainPayrollReceived } from "../src/ICrosschainDisbursement.sol";
import { CCIPLocalSimulator } from "@chainlink/local/src/ccip/CCIPLocalSimulator.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC_PR is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 10_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract PayrollReceiverTest is Test {
    PayrollReceiver public payrollReceiver;
    CrossChainDisbursement public disbursement;
    CCIPLocalSimulator public simulator;
    MockUSDC_PR public usdc;

    address public admin = makeAddr("admin");
    address public engine = makeAddr("engine");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint64 public chainSelector;
    IRouterClient public sourceRouter;
    address public routerAddress;

    bytes32 public aliceId = keccak256("alice-001");
    bytes32 public bobId = keccak256("bob-002");
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
        routerAddress = address(sourceRouter);

        vm.startPrank(admin);
        usdc = new MockUSDC_PR();

        // Deploy sender
        disbursement = new CrossChainDisbursement(routerAddress, admin);
        disbursement.grantRole(disbursement.ENGINE_ROLE(), engine);

        // Deploy receiver — authorized sender is the disbursement contract
        payrollReceiver = new PayrollReceiver(
            routerAddress, admin, address(disbursement), chainSelector
        );

        // Point sender at receiver
        disbursement.setReceiver(chainSelector, address(payrollReceiver));

        // Fund receiver with payment tokens
        usdc.transfer(address(payrollReceiver), 1_000_000e6);

        vm.stopPrank();
    }

    function test_deployment() public view {
        assertEq(payrollReceiver.getRouter(), routerAddress);
        assertEq(payrollReceiver.owner(), admin);
        assertEq(payrollReceiver.authorizedSender(), address(disbursement));
        assertEq(payrollReceiver.sourceChainSelector(), chainSelector);
    }

    function test_receiveAndDistribute() public {
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(engine);
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));

        assertEq(usdc.balanceOf(alice) - balanceBefore, SALARY);
        assertEq(payrollReceiver.getDisbursementCount(), 1);
    }

    function test_receiveAndDistribute_auditTrail() public {
        vm.prank(engine);
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));

        (
            bytes32 messageId,
            uint64 srcChain,
            bytes32 empId,
            address emp,
            uint256 amount,
            address token,
            uint256 ts
        ) = payrollReceiver.disbursements(0);

        assertTrue(messageId != bytes32(0));
        assertEq(srcChain, chainSelector);
        assertEq(empId, aliceId);
        assertEq(emp, alice);
        assertEq(amount, SALARY);
        assertEq(token, address(usdc));
        assertEq(ts, block.timestamp);
    }

    function test_receiveMultipleDisbursements() public {
        vm.startPrank(engine);
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
        disbursement.sendDisbursement(chainSelector, bobId, bob, 7_000e6, address(usdc));
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), SALARY);
        assertEq(usdc.balanceOf(bob), 7_000e6);
        assertEq(payrollReceiver.getDisbursementCount(), 2);
    }

    function test_receiveEmitsEvent() public {
        vm.prank(engine);
        // We can't predict messageId exactly, so check other fields
        vm.expectEmit(false, true, true, true);
        emit CrossChainPayrollReceived(bytes32(0), chainSelector, aliceId, alice, SALARY);
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
    }

    function test_rejectsWrongRouter() public {
        // Simulate a direct call from a non-router address
        Client.Any2EVMMessage memory fakeMsg = Client.Any2EVMMessage({
            messageId: bytes32(uint256(1)),
            sourceChainSelector: chainSelector,
            sender: abi.encode(address(disbursement)),
            data: abi.encode(
                CrossChainPayrollMessage({
                    employeeId: aliceId,
                    employee: alice,
                    salaryAmount: SALARY,
                    paymentToken: address(usdc)
                })
            ),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(alice); // Not the router
        vm.expectRevert();
        payrollReceiver.ccipReceive(fakeMsg);
    }

    function test_rejectsWrongSender() public {
        // Deploy a second disbursement (unauthorized sender)
        vm.startPrank(admin);
        CrossChainDisbursement rogue = new CrossChainDisbursement(routerAddress, admin);
        rogue.grantRole(rogue.ENGINE_ROLE(), engine);
        rogue.setReceiver(chainSelector, address(payrollReceiver));
        vm.stopPrank();

        vm.prank(engine);
        vm.expectRevert(); // ReceiverError wraps UnauthorizedSender
        rogue.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
    }

    function test_setAuthorizedSender() public {
        address newSender = makeAddr("newSender");
        vm.prank(admin);
        payrollReceiver.setAuthorizedSender(newSender);
        assertEq(payrollReceiver.authorizedSender(), newSender);
    }

    function test_setAuthorizedSender_revertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(PayrollReceiver.ZeroAddress.selector);
        payrollReceiver.setAuthorizedSender(address(0));
    }

    function test_setSourceChainSelector() public {
        uint64 newChain = 42;
        vm.prank(admin);
        payrollReceiver.setSourceChainSelector(newChain);
        assertEq(payrollReceiver.sourceChainSelector(), newChain);
    }

    function test_emergencyWithdraw() public {
        uint256 receiverBalance = usdc.balanceOf(address(payrollReceiver));
        uint256 adminBefore = usdc.balanceOf(admin);

        vm.prank(admin);
        payrollReceiver.emergencyWithdraw(address(usdc), admin, receiverBalance);

        assertEq(usdc.balanceOf(admin) - adminBefore, receiverBalance);
        assertEq(usdc.balanceOf(address(payrollReceiver)), 0);
    }

    function test_emergencyWithdraw_revertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        payrollReceiver.emergencyWithdraw(address(usdc), alice, 1_000e6);
    }

    // --- New view function tests ---

    function test_getDisbursements_paginated() public {
        vm.startPrank(engine);
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
        disbursement.sendDisbursement(chainSelector, bobId, bob, 7_000e6, address(usdc));
        disbursement.sendDisbursement(chainSelector, aliceId, alice, SALARY, address(usdc));
        vm.stopPrank();

        // Read page starting at offset 1, limit 2
        DisbursementRecord[] memory page = payrollReceiver.getDisbursements(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].employeeId, bobId);
        assertEq(page[1].employeeId, aliceId);
    }

    function test_getDisbursements_offsetBeyondLength() public view {
        DisbursementRecord[] memory page = payrollReceiver.getDisbursements(100, 10);
        assertEq(page.length, 0);
    }

    function test_getTokenBalance() public view {
        uint256 bal = payrollReceiver.getTokenBalance(address(usdc));
        assertEq(bal, 1_000_000e6);
    }
}

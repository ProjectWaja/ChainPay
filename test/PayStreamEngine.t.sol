// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { PayStreamEngine, PayrollRecord, CrossChainPaymentInitiated } from "../src/PayStreamEngine.sol";
import { CrossChainDisbursement } from "../src/CrossChainDisbursement.sol";
import { PayrollReceiver } from "../src/PayrollReceiver.sol";
import { CCIPLocalSimulator } from "@chainlink/local/src/ccip/CCIPLocalSimulator.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock ERC20 for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 10_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract PayStreamEngineTest is Test {
    PayStreamEngine public engine;
    MockUSDC public usdc;

    address public admin = makeAddr("admin");
    address public automator = makeAddr("automator");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public aliceId = keccak256("alice-001");
    bytes32 public bobId = keccak256("bob-002");

    uint256 public constant SALARY = 5_000e6; // $5,000 USDC
    uint64 public constant BIWEEKLY = 2 weeks;

    function setUp() public {
        vm.startPrank(admin);
        usdc = new MockUSDC();
        engine = new PayStreamEngine(address(usdc), admin);
        engine.grantRole(engine.AUTOMATION_ROLE(), automator);

        // Fund the engine with payroll
        usdc.transfer(address(engine), 1_000_000e6);
        vm.stopPrank();
    }

    function test_addEmployee() public {
        vm.prank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);

        (address emp, uint256 salary,,,,, ) = engine.payroll(aliceId);
        assertEq(emp, alice);
        assertEq(salary, SALARY);
        assertEq(engine.getEmployeeCount(), 1);
    }

    function test_addEmployee_revertsDuplicate() public {
        vm.startPrank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);

        vm.expectRevert(abi.encodeWithSelector(PayStreamEngine.EmployeeAlreadyExists.selector, aliceId));
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);
        vm.stopPrank();
    }

    function test_removeEmployee() public {
        vm.startPrank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);
        engine.removeEmployee(aliceId);
        vm.stopPrank();

        (, , , , , bool active, ) = engine.payroll(aliceId);
        assertFalse(active);
    }

    function test_checkUpkeep_noDue() public {
        vm.prank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);

        (bool upkeepNeeded, ) = engine.checkUpkeep("");
        assertFalse(upkeepNeeded);
    }

    function test_checkUpkeep_due() public {
        vm.prank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);

        // Warp forward past pay frequency
        vm.warp(block.timestamp + BIWEEKLY + 1);

        (bool upkeepNeeded, bytes memory performData) = engine.checkUpkeep("");
        assertTrue(upkeepNeeded);

        bytes32[] memory due = abi.decode(performData, (bytes32[]));
        assertEq(due.length, 1);
        assertEq(due[0], aliceId);
    }

    function test_performUpkeep_paysSingleEmployee() public {
        vm.prank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);

        vm.warp(block.timestamp + BIWEEKLY + 1);

        (, bytes memory performData) = engine.checkUpkeep("");

        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(automator);
        engine.performUpkeep(performData);

        assertEq(usdc.balanceOf(alice) - balanceBefore, SALARY);
        assertEq(engine.totalPayrollRuns(), 1);
    }

    function test_performUpkeep_paysMultipleEmployees() public {
        vm.startPrank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);
        engine.addEmployee(bobId, bob, 7_000e6, BIWEEKLY, uint64(block.timestamp), 0);
        vm.stopPrank();

        vm.warp(block.timestamp + BIWEEKLY + 1);

        (, bytes memory performData) = engine.checkUpkeep("");

        vm.prank(automator);
        engine.performUpkeep(performData);

        assertEq(usdc.balanceOf(alice), SALARY);
        assertEq(usdc.balanceOf(bob), 7_000e6);
    }

    function test_performUpkeep_revertsUnauthorized() public {
        vm.prank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);

        vm.warp(block.timestamp + BIWEEKLY + 1);
        (, bytes memory performData) = engine.checkUpkeep("");

        vm.prank(alice); // Not automator
        vm.expectRevert();
        engine.performUpkeep(performData);
    }

    function test_getNextPaymentDue() public {
        uint64 startTime = uint64(block.timestamp);

        vm.prank(admin);
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, startTime, 0);

        uint64 nextDue = engine.getNextPaymentDue(aliceId);
        assertEq(nextDue, startTime + BIWEEKLY);
    }

    // --- Cross-Chain Integration Tests ---

    function test_crossChain_e2e() public {
        // Set up CCIP infrastructure
        CCIPLocalSimulator simulator = new CCIPLocalSimulator();
        (uint64 chainSel, IRouterClient router_,,,,, ) = simulator.configuration();

        vm.startPrank(admin);

        // Deploy sender and receiver
        CrossChainDisbursement disbursement = new CrossChainDisbursement(address(router_), admin);
        PayrollReceiver payrollReceiver = new PayrollReceiver(
            address(router_), admin, address(disbursement), chainSel
        );

        disbursement.setReceiver(chainSel, address(payrollReceiver));
        disbursement.grantRole(disbursement.ENGINE_ROLE(), address(engine));

        // Wire up engine
        engine.setCrossChainModule(address(disbursement));

        // Fund receiver with USDC for destination-chain payments
        usdc.transfer(address(payrollReceiver), 100_000e6);

        // Add cross-chain employee
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), chainSel);
        vm.stopPrank();

        // Warp and trigger payroll
        vm.warp(block.timestamp + BIWEEKLY + 1);
        (, bytes memory performData) = engine.checkUpkeep("");

        vm.prank(automator);
        engine.performUpkeep(performData);

        // Alice got paid on the "destination chain" (simulated locally)
        assertEq(usdc.balanceOf(alice), SALARY);
        assertEq(payrollReceiver.getDisbursementCount(), 1);
        assertEq(engine.totalPayrollRuns(), 1);
    }

    function test_crossChain_mixedBatch() public {
        CCIPLocalSimulator simulator = new CCIPLocalSimulator();
        (uint64 chainSel, IRouterClient router_,,,,, ) = simulator.configuration();

        vm.startPrank(admin);

        CrossChainDisbursement disbursement = new CrossChainDisbursement(address(router_), admin);
        PayrollReceiver payrollReceiver = new PayrollReceiver(
            address(router_), admin, address(disbursement), chainSel
        );
        disbursement.setReceiver(chainSel, address(payrollReceiver));
        disbursement.grantRole(disbursement.ENGINE_ROLE(), address(engine));

        engine.setCrossChainModule(address(disbursement));
        usdc.transfer(address(payrollReceiver), 100_000e6);

        // Alice = same chain, Bob = cross chain
        engine.addEmployee(aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp), 0);
        engine.addEmployee(bobId, bob, 7_000e6, BIWEEKLY, uint64(block.timestamp), chainSel);
        vm.stopPrank();

        vm.warp(block.timestamp + BIWEEKLY + 1);
        (, bytes memory performData) = engine.checkUpkeep("");

        vm.prank(automator);
        engine.performUpkeep(performData);

        // Alice paid same-chain (from engine balance)
        assertEq(usdc.balanceOf(alice), SALARY);
        // Bob paid cross-chain (from receiver balance)
        assertEq(usdc.balanceOf(bob), 7_000e6);
    }

    function test_crossChain_revertsNoModule() public {
        vm.prank(admin);
        engine.addEmployee(
            aliceId, alice, SALARY, BIWEEKLY, uint64(block.timestamp),
            16015286601757825753 // Non-zero chain selector
        );

        vm.warp(block.timestamp + BIWEEKLY + 1);
        (, bytes memory performData) = engine.checkUpkeep("");

        vm.prank(automator);
        vm.expectRevert(PayStreamEngine.CrossChainModuleNotSet.selector);
        engine.performUpkeep(performData);
    }

    function test_setCrossChainModule_adminOnly() public {
        address module = makeAddr("module");

        vm.prank(admin);
        engine.setCrossChainModule(module);
        assertEq(address(engine.crossChainModule()), module);

        vm.prank(alice); // Not admin
        vm.expectRevert();
        engine.setCrossChainModule(module);
    }
}

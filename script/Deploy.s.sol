// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PayStreamEngine } from "../src/PayStreamEngine.sol";
import { CrossChainDisbursement } from "../src/CrossChainDisbursement.sol";
import { PayrollReceiver } from "../src/PayrollReceiver.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { MockRouter } from "../src/mocks/MockRouter.sol";

/// @title Deploy — Full deployment script for ChainPay
/// @notice Deploys all contracts, wires roles, and funds for local or testnet
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Use env addresses for testnet, or deploy mocks for local
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0));
        address routerAddr = vm.envOr("CCIP_ROUTER", address(0));
        uint64 chainSelector = uint64(vm.envOr("CHAIN_SELECTOR", uint256(16015286601757825753)));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mocks if addresses not provided (local Anvil)
        MockUSDC usdc;
        MockRouter mockRouter;

        if (usdcAddr == address(0)) {
            usdc = new MockUSDC();
            usdcAddr = address(usdc);
            console2.log("MockUSDC deployed:", usdcAddr);
        } else {
            console2.log("Using existing USDC:", usdcAddr);
        }

        if (routerAddr == address(0)) {
            mockRouter = new MockRouter();
            routerAddr = address(mockRouter);
            console2.log("MockRouter deployed:", routerAddr);
        } else {
            console2.log("Using existing CCIP Router:", routerAddr);
        }

        // Deploy core contracts
        PayStreamEngine engine = new PayStreamEngine(usdcAddr, deployer);
        console2.log("PayStreamEngine deployed:", address(engine));

        CrossChainDisbursement disbursement = new CrossChainDisbursement(routerAddr, deployer);
        console2.log("CrossChainDisbursement deployed:", address(disbursement));

        PayrollReceiver receiver = new PayrollReceiver(
            routerAddr, deployer, address(disbursement), chainSelector
        );
        console2.log("PayrollReceiver deployed:", address(receiver));

        // Wire: engine → disbursement module
        engine.setCrossChainModule(address(disbursement));
        console2.log("Engine cross-chain module set");

        // Wire: disbursement grants ENGINE_ROLE to engine
        disbursement.grantRole(disbursement.ENGINE_ROLE(), address(engine));
        console2.log("ENGINE_ROLE granted to engine");

        // Wire: disbursement sets receiver for chain
        disbursement.setReceiver(chainSelector, address(receiver));
        console2.log("Receiver set for chain selector:", chainSelector);

        // Wire: engine grants AUTOMATION_ROLE to deployer (for manual triggers)
        engine.grantRole(engine.AUTOMATION_ROLE(), deployer);
        console2.log("AUTOMATION_ROLE granted to deployer");

        // Fund engine with 500k USDC
        if (address(usdc) != address(0)) {
            usdc.transfer(address(engine), 500_000e6);
            console2.log("Engine funded: 500,000 USDC");

            // Fund receiver with 200k USDC
            usdc.transfer(address(receiver), 200_000e6);
            console2.log("Receiver funded: 200,000 USDC");
        }

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployment Summary ===");
        console2.log("USDC:", usdcAddr);
        console2.log("Router:", routerAddr);
        console2.log("Engine:", address(engine));
        console2.log("Disbursement:", address(disbursement));
        console2.log("Receiver:", address(receiver));
    }
}

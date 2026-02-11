import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { deploy } from "./deploy";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");

function loadAbi(name: string) {
  const path = join(ROOT, "out", `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const args = process.argv.slice(2);
const shouldWarp = args.includes("--warp");
const shouldRun = args.includes("--run");

async function main() {
  console.log("=== ChainPay Demo Setup ===\n");

  // Step 1: Deploy all contracts
  const addresses = await deploy();

  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const rpcUrl = "http://127.0.0.1:8545";

  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });

  const engineAbi = loadAbi("PayStreamEngine");

  // Step 2: Add 5 sample employees
  console.log("\nAdding sample employees...");

  const employees = [
    { id: "alice-eng-001", addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", salary: 5_000_000_000n, chain: 0n },
    { id: "bob-design-002", addr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", salary: 7_500_000_000n, chain: 0n },
    { id: "carol-pm-003", addr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", salary: 6_000_000_000n, chain: 0n },
    { id: "dave-ops-004", addr: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", salary: 4_500_000_000n, chain: 16015286601757825753n },
    { id: "eve-sec-005", addr: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", salary: 8_000_000_000n, chain: 16015286601757825753n },
  ];

  const biweekly = 1_209_600n; // 2 weeks in seconds
  const now = await publicClient.getBlock().then((b) => b.timestamp);

  for (const emp of employees) {
    const empId = keccak256(toHex(emp.id));
    await walletClient.writeContract({
      address: addresses.engine as Address,
      abi: engineAbi,
      functionName: "addEmployee",
      args: [empId, emp.addr as Address, emp.salary, biweekly, now, emp.chain],
    });
    console.log(`  Added ${emp.id} — $${Number(emp.salary) / 1e6} USDC${emp.chain > 0n ? " (cross-chain)" : ""}`);
  }

  // Step 3: Optionally warp time
  if (shouldWarp) {
    console.log("\nFast-forwarding time by 2 weeks...");
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [1_209_601] as any,
    });
    await publicClient.request({
      method: "evm_mine" as any,
      params: [] as any,
    });
    console.log("  Time warped forward 2 weeks + 1 second");
  }

  // Step 4: Optionally trigger payroll
  if (shouldRun) {
    console.log("\nTriggering payroll run...");
    const [upkeepNeeded, performData] = await publicClient.readContract({
      address: addresses.engine as Address,
      abi: engineAbi,
      functionName: "checkUpkeep",
      args: ["0x"],
    }) as [boolean, Hex];

    if (upkeepNeeded) {
      const hash = await walletClient.writeContract({
        address: addresses.engine as Address,
        abi: engineAbi,
        functionName: "performUpkeep",
        args: [performData],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("  Payroll executed successfully!");
    } else {
      console.log("  No employees due for payment (use --warp first)");
    }
  }

  // Print summary
  console.log("\n=== Dashboard .env.local ===");
  console.log(`NEXT_PUBLIC_ENGINE_ADDRESS=${addresses.engine}`);
  console.log(`NEXT_PUBLIC_DISBURSEMENT_ADDRESS=${addresses.disbursement}`);
  console.log(`NEXT_PUBLIC_RECEIVER_ADDRESS=${addresses.receiver}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${addresses.usdc}`);
  console.log(`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID_HERE`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=31337`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

const EMPLOYEES = [
  { id: "alice-eng-001", addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", salary: 5_000_000_000n, chain: 0n },
  { id: "bob-design-002", addr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", salary: 7_500_000_000n, chain: 0n },
  { id: "carol-pm-003", addr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", salary: 6_000_000_000n, chain: 0n },
  { id: "dave-ops-004", addr: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", salary: 4_500_000_000n, chain: 16015286601757825753n },
  { id: "eve-sec-005", addr: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", salary: 8_000_000_000n, chain: 16015286601757825753n },
];

export async function POST(req: NextRequest) {
  try {
    const { engine } = (await req.json()) as Record<string, Address>;
    const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const publicClient = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
    const walletClient = createWalletClient({ account, chain: foundry, transport: http("http://127.0.0.1:8545") });

    const path = join(process.cwd(), "..", "out", "PayStreamEngine.sol", "PayStreamEngine.json");
    const engineAbi = JSON.parse(readFileSync(path, "utf-8")).abi;

    const block = await publicClient.getBlock();
    const biweekly = 1_209_600n;

    for (const emp of EMPLOYEES) {
      const empId = keccak256(toHex(emp.id));
      await walletClient.writeContract({
        address: engine,
        abi: engineAbi,
        functionName: "addEmployee",
        args: [empId, emp.addr as Address, emp.salary, biweekly, block.timestamp, emp.chain],
      });
    }

    return NextResponse.json({ success: true, count: EMPLOYEES.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

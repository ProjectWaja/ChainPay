import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { engine } = (await req.json()) as Record<string, Address>;
    const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const publicClient = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
    const walletClient = createWalletClient({ account, chain: foundry, transport: http("http://127.0.0.1:8545") });

    const path = join(process.cwd(), "..", "out", "PayStreamEngine.sol", "PayStreamEngine.json");
    const engineAbi = JSON.parse(readFileSync(path, "utf-8")).abi;

    const [upkeepNeeded, performData] = await publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: "checkUpkeep",
      args: ["0x" as Hex],
    }) as [boolean, Hex];

    if (!upkeepNeeded) {
      return NextResponse.json({ success: true, message: "No employees due for payment" });
    }

    const hash = await walletClient.writeContract({
      address: engine,
      abi: engineAbi,
      functionName: "performUpkeep",
      args: [performData],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ success: true, message: "Payroll executed" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

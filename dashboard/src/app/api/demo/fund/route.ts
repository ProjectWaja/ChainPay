import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { engine, receiver, usdc } = (await req.json()) as Record<string, Address>;
    const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const walletClient = createWalletClient({ account, chain: foundry, transport: http("http://127.0.0.1:8545") });

    const path = join(process.cwd(), "..", "out", "MockUSDC.sol", "MockUSDC.json");
    const usdcAbi = JSON.parse(readFileSync(path, "utf-8")).abi;

    await walletClient.writeContract({ address: usdc, abi: usdcAbi, functionName: "transfer", args: [engine, 500_000_000_000n] });
    await walletClient.writeContract({ address: usdc, abi: usdcAbi, functionName: "transfer", args: [receiver, 200_000_000_000n] });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

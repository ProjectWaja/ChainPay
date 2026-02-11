import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "..");

function loadArtifact(name: string) {
  const path = join(ROOT, "out", `${name}.sol`, `${name}.json`);
  const json = JSON.parse(readFileSync(path, "utf-8"));
  return { abi: json.abi, bytecode: json.bytecode.object as Hex };
}

export async function POST() {
  try {
    const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const publicClient = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
    const walletClient = createWalletClient({ account, chain: foundry, transport: http("http://127.0.0.1:8545") });

    async function deployContract(name: string, args: unknown[] = []): Promise<Address> {
      const { abi, bytecode } = loadArtifact(name);
      const hash = await walletClient.deployContract({ abi, bytecode, args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt.contractAddress!;
    }

    const usdc = await deployContract("MockUSDC");
    const router = await deployContract("MockRouter");
    const engine = await deployContract("PayStreamEngine", [usdc, account.address]);
    const disbursement = await deployContract("CrossChainDisbursement", [router, account.address]);
    const chainSelector = 16015286601757825753n;
    const receiver = await deployContract("PayrollReceiver", [router, account.address, disbursement, chainSelector]);

    // Wire contracts
    const engineAbi = loadArtifact("PayStreamEngine").abi;
    const disbursementAbi = loadArtifact("CrossChainDisbursement").abi;
    const usdcAbi = loadArtifact("MockUSDC").abi;

    await walletClient.writeContract({ address: engine, abi: engineAbi, functionName: "setCrossChainModule", args: [disbursement] });

    const engineRole = await publicClient.readContract({ address: disbursement, abi: disbursementAbi, functionName: "ENGINE_ROLE" });
    await walletClient.writeContract({ address: disbursement, abi: disbursementAbi, functionName: "grantRole", args: [engineRole, engine] });
    await walletClient.writeContract({ address: disbursement, abi: disbursementAbi, functionName: "setReceiver", args: [chainSelector, receiver] });

    const automationRole = await publicClient.readContract({ address: engine, abi: engineAbi, functionName: "AUTOMATION_ROLE" });
    await walletClient.writeContract({ address: engine, abi: engineAbi, functionName: "grantRole", args: [automationRole, account.address] });

    // Fund
    await walletClient.writeContract({ address: usdc, abi: usdcAbi, functionName: "transfer", args: [engine, 500_000_000_000n] });
    await walletClient.writeContract({ address: usdc, abi: usdcAbi, functionName: "transfer", args: [receiver, 200_000_000_000n] });

    return NextResponse.json({
      success: true,
      addresses: { usdc, router, engine, disbursement, receiver },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

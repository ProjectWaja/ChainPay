import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");

function loadArtifact(name: string) {
  const path = join(ROOT, "out", `${name}.sol`, `${name}.json`);
  const json = JSON.parse(readFileSync(path, "utf-8"));
  return { abi: json.abi, bytecode: json.bytecode.object as Hex };
}

export async function deploy(rpcUrl = "http://127.0.0.1:8545", privateKey?: Hex) {
  const account = privateKeyToAccount(
    privateKey ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });

  async function deployContract(name: string, args: any[] = []): Promise<Address> {
    const { abi, bytecode } = loadArtifact(name);
    const hash = await walletClient.deployContract({ abi, bytecode, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ${name} deployed: ${receipt.contractAddress}`);
    return receipt.contractAddress!;
  }

  console.log("Deploying ChainPay to Anvil...\n");

  // Deploy mocks
  const usdc = await deployContract("MockUSDC");
  const router = await deployContract("MockRouter");

  // Deploy core contracts
  const engine = await deployContract("PayStreamEngine", [usdc, account.address]);
  const disbursement = await deployContract("CrossChainDisbursement", [router, account.address]);

  const chainSelector = 16015286601757825753n;
  const receiver = await deployContract("PayrollReceiver", [
    router,
    account.address,
    disbursement,
    chainSelector,
  ]);

  console.log("\nWiring contracts...");

  // Load ABIs for write calls
  const engineAbi = loadArtifact("PayStreamEngine").abi;
  const disbursementAbi = loadArtifact("CrossChainDisbursement").abi;
  const usdcAbi = loadArtifact("MockUSDC").abi;

  // Wire: engine → disbursement module
  await walletClient.writeContract({
    address: engine,
    abi: engineAbi,
    functionName: "setCrossChainModule",
    args: [disbursement],
  });
  console.log("  Engine cross-chain module set");

  // Wire: disbursement grants ENGINE_ROLE to engine
  const engineRole = await publicClient.readContract({
    address: disbursement,
    abi: disbursementAbi,
    functionName: "ENGINE_ROLE",
  });
  await walletClient.writeContract({
    address: disbursement,
    abi: disbursementAbi,
    functionName: "grantRole",
    args: [engineRole, engine],
  });
  console.log("  ENGINE_ROLE granted to engine");

  // Wire: disbursement sets receiver
  await walletClient.writeContract({
    address: disbursement,
    abi: disbursementAbi,
    functionName: "setReceiver",
    args: [chainSelector, receiver],
  });
  console.log("  Receiver set for chain selector");

  // Wire: engine grants AUTOMATION_ROLE to deployer
  const automationRole = await publicClient.readContract({
    address: engine,
    abi: engineAbi,
    functionName: "AUTOMATION_ROLE",
  });
  await walletClient.writeContract({
    address: engine,
    abi: engineAbi,
    functionName: "grantRole",
    args: [automationRole, account.address],
  });
  console.log("  AUTOMATION_ROLE granted to deployer");

  // Fund engine (500k USDC) + receiver (200k USDC)
  await walletClient.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "transfer",
    args: [engine, 500_000_000_000n], // 500k * 1e6
  });
  console.log("  Engine funded: 500,000 USDC");

  await walletClient.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "transfer",
    args: [receiver, 200_000_000_000n], // 200k * 1e6
  });
  console.log("  Receiver funded: 200,000 USDC");

  const addresses = {
    usdc,
    router,
    engine,
    disbursement,
    receiver,
    deployer: account.address,
    chainSelector: chainSelector.toString(),
  };

  // Write deployed addresses
  mkdirSync(join(ROOT, "config"), { recursive: true });
  const outPath = join(ROOT, "config", "deployed-addresses.json");
  writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses written to ${outPath}`);

  return addresses;
}

// Run if executed directly
if (import.meta.main) {
  deploy().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

import { NextResponse } from "next/server";

const RPC_URL = "http://127.0.0.1:8545";

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

export async function POST() {
  try {
    await rpc("evm_increaseTime", [1_209_601]);
    await rpc("evm_mine");

    return NextResponse.json({ success: true, message: "Time warped forward 2 weeks + 1 second" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

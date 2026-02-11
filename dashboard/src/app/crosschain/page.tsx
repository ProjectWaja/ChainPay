"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import {
  RECEIVER_ADDRESS,
  USDC_ADDRESS,
  DISBURSEMENT_ADDRESS,
  receiverAbi,
  disbursementAbi,
} from "@/lib/contracts";
import { usePayrollData } from "@/hooks/usePayrollData";
import { formatUSDC, truncateAddress, truncateBytes32 } from "@/lib/format";

const SEPOLIA_CHAIN_SELECTOR = 16015286601757825753n;

function DisbursementTable() {
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const { data: countData } = useReadContract({
    address: RECEIVER_ADDRESS,
    abi: receiverAbi,
    functionName: "getDisbursementCount",
  });
  const count = Number(countData ?? 0n);

  const { data } = useReadContract({
    address: RECEIVER_ADDRESS,
    abi: receiverAbi,
    functionName: "getDisbursements",
    args: [BigInt(offset), BigInt(limit)],
  });

  const disbursements = (data ?? []) as Array<{
    messageId: `0x${string}`;
    sourceChainSelector: bigint;
    employeeId: `0x${string}`;
    employee: `0x${string}`;
    salaryAmount: bigint;
    paymentToken: `0x${string}`;
    timestamp: bigint;
  }>;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">Disbursement History ({count} total)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-600 text-gray-300 rounded transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">{offset + 1}–{Math.min(offset + limit, count)}</span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= count}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-600 text-gray-300 rounded transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {disbursements.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500 text-center">No cross-chain disbursements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Message ID</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {disbursements.map((d, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{truncateBytes32(d.messageId)}</td>
                  <td className="px-4 py-3 text-sm font-mono">{truncateAddress(d.employee)}</td>
                  <td className="px-4 py-3 text-sm">{formatUSDC(d.salaryAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(Number(d.timestamp) * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CrossChainPage() {
  const { crossChainModule, receiverBalance, disbursementCount } = usePayrollData();

  const { data: receiverAddr } = useReadContract({
    address: DISBURSEMENT_ADDRESS,
    abi: disbursementAbi,
    functionName: "receivers",
    args: [SEPOLIA_CHAIN_SELECTOR],
  });

  const { data: authorizedSender } = useReadContract({
    address: RECEIVER_ADDRESS,
    abi: receiverAbi,
    functionName: "authorizedSender",
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Cross-Chain Status</h1>
        <p className="text-sm text-gray-400 mt-1">CCIP disbursement configuration and history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Chain Configuration</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Cross-Chain Module</span>
              <span className="font-mono text-xs text-blue-400">
                {crossChainModule && crossChainModule !== "0x0000000000000000000000000000000000000000"
                  ? truncateAddress(crossChainModule)
                  : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Receiver (Sepolia)</span>
              <span className="font-mono text-xs text-blue-400">
                {receiverAddr ? truncateAddress(receiverAddr as string) : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Authorized Sender</span>
              <span className="font-mono text-xs text-blue-400">
                {authorizedSender ? truncateAddress(authorizedSender as string) : "Not set"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Receiver Stats</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Token Balance</span>
              <span className="text-white font-medium">
                {receiverBalance !== undefined ? formatUSDC(receiverBalance) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Disbursements Processed</span>
              <span className="text-white font-medium">{disbursementCount?.toString() ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token Address</span>
              <span className="font-mono text-xs text-gray-400">{truncateAddress(USDC_ADDRESS)}</span>
            </div>
          </div>
        </div>
      </div>

      <DisbursementTable />
    </div>
  );
}

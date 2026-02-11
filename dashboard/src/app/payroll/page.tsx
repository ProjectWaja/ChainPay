"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ENGINE_ADDRESS, engineAbi } from "@/lib/contracts";
import { usePayrollData } from "@/hooks/usePayrollData";
import { formatUSDC } from "@/lib/format";
import type { Hex } from "viem";

export default function PayrollPage() {
  const { paymentsDueNow, totalPayrollRuns, engineBalance, isLoading } = usePayrollData();
  const dueCount = paymentsDueNow?.length ?? 0;

  const { data: upkeepResult } = useReadContract({
    address: ENGINE_ADDRESS,
    abi: engineAbi,
    functionName: "checkUpkeep",
    args: ["0x" as Hex],
  });

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isRunning, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleRunPayroll = () => {
    if (!upkeepResult) return;
    const [upkeepNeeded, performData] = upkeepResult as [boolean, Hex];
    if (!upkeepNeeded) return;

    writeContract({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "performUpkeep",
      args: [performData],
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Payroll Execution</h1>
        <p className="text-sm text-gray-400 mt-1">Trigger and monitor payroll runs</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Engine Balance</p>
          <p className="text-2xl font-semibold text-white">
            {engineBalance !== undefined ? formatUSDC(engineBalance) : "—"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Employees Due</p>
          <p className={`text-2xl font-semibold ${dueCount > 0 ? "text-yellow-400" : "text-green-400"}`}>
            {isLoading ? "..." : dueCount}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Total Runs</p>
          <p className="text-2xl font-semibold text-white">{totalPayrollRuns?.toString() ?? "—"}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-400">Run Payroll</h2>
          <button
            onClick={handleRunPayroll}
            disabled={dueCount === 0 || isRunning}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isRunning ? "Executing..." : `Run Payroll (${dueCount} due)`}
          </button>
        </div>

        {isSuccess && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-sm text-green-400">
            Payroll executed successfully!
          </div>
        )}

        {dueCount === 0 && !isLoading && (
          <p className="text-sm text-gray-500">No employees are currently due for payment. Use the time warp in Demo Controls to fast-forward.</p>
        )}

        {paymentsDueNow && paymentsDueNow.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Due Employee IDs</p>
            {paymentsDueNow.map((id) => (
              <div key={id} className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-gray-800/50 rounded px-3 py-2">
                {id}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

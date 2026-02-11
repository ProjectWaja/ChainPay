"use client";

import MetricCard from "@/components/MetricCard";
import DemoControlPanel from "@/components/DemoControlPanel";
import { usePayrollData } from "@/hooks/usePayrollData";
import { formatUSDC, truncateAddress } from "@/lib/format";

export default function OverviewPage() {
  const {
    employeeCount,
    engineBalance,
    totalPayrollRuns,
    paymentsDueNow,
    crossChainModule,
    isLoading,
  } = usePayrollData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading dashboard data...</p>
      </div>
    );
  }

  const dueCount = paymentsDueNow?.length ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-sm text-gray-400 mt-1">Cross-chain payroll status at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Engine Balance"
          value={engineBalance !== undefined ? formatUSDC(engineBalance) : "—"}
          subtitle="USDC available for payroll"
        />
        <MetricCard
          label="Total Employees"
          value={employeeCount?.toString() ?? "—"}
          subtitle="On payroll"
        />
        <MetricCard
          label="Payroll Runs"
          value={totalPayrollRuns?.toString() ?? "—"}
          subtitle="Completed cycles"
        />
        <MetricCard
          label="Due Now"
          value={dueCount.toString()}
          subtitle={dueCount > 0 ? "Employees awaiting payment" : "All payments current"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Cross-Chain Module</span>
              <span className="text-xs font-mono text-blue-400">
                {crossChainModule && crossChainModule !== "0x0000000000000000000000000000000000000000"
                  ? truncateAddress(crossChainModule)
                  : "Not configured"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Payments Due</span>
              <span className={`text-sm font-medium ${dueCount > 0 ? "text-yellow-400" : "text-green-400"}`}>
                {dueCount > 0 ? `${dueCount} pending` : "All current"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Network</span>
              <span className="text-xs text-gray-400">Anvil (Local)</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/employees" className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
              Manage Employees
            </a>
            <a href="/payroll" className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
              Run Payroll
            </a>
            <a href="/crosschain" className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
              View Cross-Chain History
            </a>
          </div>
        </div>
      </div>

      <DemoControlPanel />
    </div>
  );
}

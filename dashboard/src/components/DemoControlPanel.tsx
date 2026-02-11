"use client";

import { useState } from "react";
import type { Address } from "viem";

interface Addresses {
  usdc: Address;
  router: Address;
  engine: Address;
  disbursement: Address;
  receiver: Address;
}

export default function DemoControlPanel() {
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [status, setStatus] = useState<Record<string, { loading: boolean; message: string }>>({});

  const updateStatus = (key: string, loading: boolean, message: string) => {
    setStatus((prev) => ({ ...prev, [key]: { loading, message } }));
  };

  const handleDeploy = async () => {
    updateStatus("deploy", true, "Deploying...");
    try {
      const res = await fetch("/api/demo/setup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses);
        updateStatus("deploy", false, "Deployed successfully!");
      } else {
        updateStatus("deploy", false, `Error: ${data.error}`);
      }
    } catch (e) {
      updateStatus("deploy", false, `Error: ${e}`);
    }
  };

  const handleEmployees = async () => {
    if (!addresses) return;
    updateStatus("employees", true, "Adding employees...");
    try {
      const res = await fetch("/api/demo/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: addresses.engine }),
      });
      const data = await res.json();
      updateStatus("employees", false, data.success ? `Added ${data.count} employees` : `Error: ${data.error}`);
    } catch (e) {
      updateStatus("employees", false, `Error: ${e}`);
    }
  };

  const handleFund = async () => {
    if (!addresses) return;
    updateStatus("fund", true, "Funding...");
    try {
      const res = await fetch("/api/demo/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addresses),
      });
      const data = await res.json();
      updateStatus("fund", false, data.success ? "Funded successfully!" : `Error: ${data.error}`);
    } catch (e) {
      updateStatus("fund", false, `Error: ${e}`);
    }
  };

  const handleWarp = async () => {
    updateStatus("warp", true, "Warping time...");
    try {
      const res = await fetch("/api/demo/warp", { method: "POST" });
      const data = await res.json();
      updateStatus("warp", false, data.success ? data.message : `Error: ${data.error}`);
    } catch (e) {
      updateStatus("warp", false, `Error: ${e}`);
    }
  };

  const handlePayroll = async () => {
    if (!addresses) return;
    updateStatus("payroll", true, "Running payroll...");
    try {
      const res = await fetch("/api/demo/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: addresses.engine }),
      });
      const data = await res.json();
      updateStatus("payroll", false, data.success ? data.message : `Error: ${data.error}`);
    } catch (e) {
      updateStatus("payroll", false, `Error: ${e}`);
    }
  };

  const steps = [
    { key: "deploy", label: "Deploy Contracts", onClick: handleDeploy, needsAddrs: false },
    { key: "employees", label: "Add Sample Employees", onClick: handleEmployees, needsAddrs: true },
    { key: "fund", label: "Fund Engine & Receiver", onClick: handleFund, needsAddrs: true },
    { key: "warp", label: "Fast-Forward Time (2 weeks)", onClick: handleWarp, needsAddrs: false },
    { key: "payroll", label: "Run Payroll", onClick: handlePayroll, needsAddrs: true },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <span>Demo Controls (Anvil)</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-800 pt-4">
          {addresses && (
            <div className="bg-gray-800/50 rounded-lg p-3 text-xs font-mono space-y-1">
              <p className="text-gray-400">Engine: <span className="text-blue-400">{addresses.engine}</span></p>
              <p className="text-gray-400">USDC: <span className="text-blue-400">{addresses.usdc}</span></p>
              <p className="text-gray-400">Disbursement: <span className="text-blue-400">{addresses.disbursement}</span></p>
              <p className="text-gray-400">Receiver: <span className="text-blue-400">{addresses.receiver}</span></p>
            </div>
          )}

          {steps.map(({ key, label, onClick, needsAddrs }) => (
            <div key={key} className="flex items-center gap-3">
              <button
                onClick={onClick}
                disabled={status[key]?.loading || (needsAddrs && !addresses)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                {status[key]?.loading ? "..." : label}
              </button>
              {status[key]?.message && (
                <span className={`text-xs ${status[key]?.message.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                  {status[key].message}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ENGINE_ADDRESS, DISBURSEMENT_ADDRESS, RECEIVER_ADDRESS, USDC_ADDRESS, engineAbi } from "@/lib/contracts";
import { truncateAddress } from "@/lib/format";

export default function SettingsPage() {
  const [addresses, setAddresses] = useState({
    engine: ENGINE_ADDRESS,
    disbursement: DISBURSEMENT_ADDRESS,
    receiver: RECEIVER_ADDRESS,
    usdc: USDC_ADDRESS,
  });

  const [crossChainModuleAddr, setCrossChainModuleAddr] = useState("");
  const { writeContract: writeCrossChain, data: crossChainHash } = useWriteContract();
  const { isLoading: isCrossChainLoading, isSuccess: isCrossChainSuccess } = useWaitForTransactionReceipt({ hash: crossChainHash });

  const [grantRoleAddr, setGrantRoleAddr] = useState("");
  const [roleType, setRoleType] = useState<"admin" | "automation">("admin");
  const { writeContract: writeRole, data: roleHash } = useWriteContract();
  const { isLoading: isRoleLoading, isSuccess: isRoleSuccess } = useWaitForTransactionReceipt({ hash: roleHash });

  useEffect(() => {
    const saved = localStorage.getItem("chainpay-addresses");
    if (saved) {
      try { setAddresses(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const saveAddresses = () => {
    localStorage.setItem("chainpay-addresses", JSON.stringify(addresses));
  };

  const handleSetCrossChainModule = () => {
    writeCrossChain({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "setCrossChainModule",
      args: [crossChainModuleAddr as `0x${string}`],
    });
  };

  const handleGrantRole = () => {
    writeRole({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "grantRole",
      args: [
        roleType === "admin"
          ? "0x8f4f2da22e8ac8f11e15f9fc141cddbb5deea8800186560abb6e68c5496619a9" as `0x${string}`
          : "0x38e75e683708bd7d0cfdc8c3ee0a3e08b1a59feca73b38d04c02a9ee36fb6d6b" as `0x${string}`,
        grantRoleAddr as `0x${string}`,
      ],
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Contract addresses and admin functions</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-400">Contract Addresses</h2>
        <div className="space-y-3">
          {Object.entries(addresses).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-sm text-gray-400 w-28 capitalize">{key}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setAddresses({ ...addresses, [key]: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-white"
              />
            </div>
          ))}
          <button
            onClick={saveAddresses}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            Save to localStorage
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Active Configuration</h2>
        <div className="space-y-2 text-sm">
          <p className="text-gray-300">Engine: <span className="font-mono text-xs text-blue-400">{truncateAddress(ENGINE_ADDRESS)}</span></p>
          <p className="text-gray-300">Disbursement: <span className="font-mono text-xs text-blue-400">{truncateAddress(DISBURSEMENT_ADDRESS)}</span></p>
          <p className="text-gray-300">Receiver: <span className="font-mono text-xs text-blue-400">{truncateAddress(RECEIVER_ADDRESS)}</span></p>
          <p className="text-gray-300">USDC: <span className="font-mono text-xs text-blue-400">{truncateAddress(USDC_ADDRESS)}</span></p>
          <p className="text-xs text-gray-500 mt-2">Active addresses come from env vars. Redeploy to update.</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-400">Set Cross-Chain Module</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={crossChainModuleAddr}
            onChange={(e) => setCrossChainModuleAddr(e.target.value)}
            placeholder="0x..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-white placeholder-gray-500"
          />
          <button
            onClick={handleSetCrossChainModule}
            disabled={isCrossChainLoading || !crossChainModuleAddr}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            {isCrossChainLoading ? "..." : "Set"}
          </button>
        </div>
        {isCrossChainSuccess && <p className="text-xs text-green-400">Cross-chain module updated!</p>}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-400">Grant Role</h2>
        <div className="flex items-center gap-3">
          <select
            value={roleType}
            onChange={(e) => setRoleType(e.target.value as "admin" | "automation")}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
          >
            <option value="admin">PAYROLL_ADMIN</option>
            <option value="automation">AUTOMATION</option>
          </select>
          <input
            type="text"
            value={grantRoleAddr}
            onChange={(e) => setGrantRoleAddr(e.target.value)}
            placeholder="Address to grant role"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-white placeholder-gray-500"
          />
          <button
            onClick={handleGrantRole}
            disabled={isRoleLoading || !grantRoleAddr}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            {isRoleLoading ? "..." : "Grant"}
          </button>
        </div>
        {isRoleSuccess && <p className="text-xs text-green-400">Role granted successfully!</p>}
      </div>
    </div>
  );
}

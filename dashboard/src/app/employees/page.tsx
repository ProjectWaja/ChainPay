"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, toHex, type Address } from "viem";
import { ENGINE_ADDRESS, engineAbi } from "@/lib/contracts";
import { usePayrollData } from "@/hooks/usePayrollData";
import { formatUSDC, truncateAddress, formatFrequency } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

function EmployeeRow({ id }: { id: `0x${string}` }) {
  const { data } = useReadContract({
    address: ENGINE_ADDRESS,
    abi: engineAbi,
    functionName: "payroll",
    args: [id],
  });

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isRemoving } = useWaitForTransactionReceipt({ hash });

  const [editingSalary, setEditingSalary] = useState(false);
  const [newSalary, setNewSalary] = useState("");

  if (!data) return null;

  const [employee, salaryAmount, payFrequency, lastPaidAt, , active, destinationChainSelector] = data;
  const nextDue = Number(lastPaidAt) + Number(payFrequency);
  const now = Math.floor(Date.now() / 1000);
  const isDue = now >= nextDue && active;
  const isCrossChain = Number(destinationChainSelector) > 0;

  const status = !active ? "inactive" : isDue ? "due" : isCrossChain ? "crosschain" : "active";

  const handleRemove = () => {
    writeContract({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "removeEmployee",
      args: [id],
    });
  };

  const handleUpdateSalary = () => {
    const amount = BigInt(Math.floor(parseFloat(newSalary) * 1e6));
    writeContract({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "updateEmployeeSalary",
      args: [id, amount],
    });
    setEditingSalary(false);
    setNewSalary("");
  };

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50">
      <td className="px-4 py-3 font-mono text-xs text-gray-400">{id.slice(0, 10)}...</td>
      <td className="px-4 py-3 text-sm font-mono">{truncateAddress(employee)}</td>
      <td className="px-4 py-3 text-sm">
        {editingSalary ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newSalary}
              onChange={(e) => setNewSalary(e.target.value)}
              className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              placeholder="Amount"
            />
            <button onClick={handleUpdateSalary} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
            <button onClick={() => setEditingSalary(false)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
          </div>
        ) : (
          <span onClick={() => setEditingSalary(true)} className="cursor-pointer hover:text-blue-400">
            {formatUSDC(salaryAmount)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{formatFrequency(Number(payFrequency))}</td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {new Date(Number(lastPaidAt) * 1000).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {new Date(nextDue * 1000).toLocaleDateString()}
      </td>
      <td className="px-4 py-3"><StatusBadge status={status} /></td>
      <td className="px-4 py-3">
        {active && (
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className="text-xs text-red-400 hover:text-red-300 disabled:text-gray-600"
          >
            {isRemoving ? "..." : "Remove"}
          </button>
        )}
      </td>
    </tr>
  );
}

function AddEmployeeForm() {
  const [formData, setFormData] = useState({
    id: "",
    address: "",
    salary: "",
    frequency: "1209600",
    chain: "0",
  });
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading } = useWaitForTransactionReceipt({ hash });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const empId = keccak256(toHex(formData.id));
    const salary = BigInt(Math.floor(parseFloat(formData.salary) * 1e6));
    const now = BigInt(Math.floor(Date.now() / 1000));

    writeContract({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "addEmployee",
      args: [empId, formData.address as Address, salary, BigInt(formData.frequency), now, BigInt(formData.chain)],
    });

    setFormData({ id: "", address: "", salary: "", frequency: "1209600", chain: "0" });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-gray-400">Add Employee</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Employee ID (e.g., alice-001)"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500"
          required
        />
        <input
          type="text"
          placeholder="Wallet Address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500"
          required
        />
        <input
          type="number"
          placeholder="Salary (USDC)"
          value={formData.salary}
          onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500"
          required
        />
        <select
          value={formData.frequency}
          onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
        >
          <option value="604800">Weekly</option>
          <option value="1209600">Biweekly</option>
          <option value="2592000">Monthly</option>
        </select>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          {isLoading ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}

export default function EmployeesPage() {
  const { employeeIds, isLoading } = usePayrollData();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Employee Management</h1>
        <p className="text-sm text-gray-400 mt-1">Manage payroll recipients and payment schedules</p>
      </div>

      <AddEmployeeForm />

      {isLoading ? (
        <p className="text-gray-500">Loading employees...</p>
      ) : !employeeIds || employeeIds.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-400">No employees on payroll yet.</p>
          <p className="text-sm text-gray-500 mt-1">Use the form above or the Demo Controls on the Overview page.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Address</th>
                  <th className="px-4 py-3 text-left">Salary</th>
                  <th className="px-4 py-3 text-left">Frequency</th>
                  <th className="px-4 py-3 text-left">Last Paid</th>
                  <th className="px-4 py-3 text-left">Next Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeIds.map((id) => (
                  <EmployeeRow key={id} id={id} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

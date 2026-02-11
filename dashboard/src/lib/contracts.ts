import type { Address } from "viem";

// Contract addresses from env vars (populated by deploy scripts)
export const ENGINE_ADDRESS = (process.env.NEXT_PUBLIC_ENGINE_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
export const DISBURSEMENT_ADDRESS = (process.env.NEXT_PUBLIC_DISBURSEMENT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
export const RECEIVER_ADDRESS = (process.env.NEXT_PUBLIC_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;

// PayStreamEngine ABI (subset for dashboard)
export const engineAbi = [
  // Views
  { type: "function", name: "getAllEmployeeIds", inputs: [], outputs: [{ type: "bytes32[]" }], stateMutability: "view" },
  { type: "function", name: "getEmployeeCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getEngineBalance", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getPaymentsDueNow", inputs: [], outputs: [{ type: "bytes32[]" }], stateMutability: "view" },
  { type: "function", name: "getNextPaymentDue", inputs: [{ name: "employeeId", type: "bytes32" }], outputs: [{ type: "uint64" }], stateMutability: "view" },
  { type: "function", name: "totalPayrollRuns", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "payroll", inputs: [{ name: "employeeId", type: "bytes32" }],
    outputs: [
      { name: "employee", type: "address" },
      { name: "salaryAmount", type: "uint256" },
      { name: "payFrequency", type: "uint64" },
      { name: "lastPaidAt", type: "uint64" },
      { name: "startDate", type: "uint64" },
      { name: "active", type: "bool" },
      { name: "destinationChainSelector", type: "uint64" },
    ],
    stateMutability: "view",
  },
  { type: "function", name: "crossChainModule", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  // Writes
  {
    type: "function", name: "addEmployee",
    inputs: [
      { name: "employeeId", type: "bytes32" },
      { name: "employee", type: "address" },
      { name: "salaryAmount", type: "uint256" },
      { name: "payFrequency", type: "uint64" },
      { name: "startDate", type: "uint64" },
      { name: "destinationChainSelector", type: "uint64" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "removeEmployee", inputs: [{ name: "employeeId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "updateEmployeeSalary", inputs: [{ name: "employeeId", type: "bytes32" }, { name: "newSalary", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "updateEmployeeChain", inputs: [{ name: "employeeId", type: "bytes32" }, { name: "newChainSelector", type: "uint64" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setCrossChainModule", inputs: [{ name: "_module", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "checkUpkeep", inputs: [{ name: "", type: "bytes" }], outputs: [{ name: "upkeepNeeded", type: "bool" }, { name: "performData", type: "bytes" }], stateMutability: "view" },
  { type: "function", name: "performUpkeep", inputs: [{ name: "performData", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "grantRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "PAYROLL_ADMIN_ROLE", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  { type: "function", name: "AUTOMATION_ROLE", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  // Events
  { type: "event", name: "PayrollExecuted", inputs: [{ name: "runId", type: "uint256", indexed: true }, { name: "employeesPaid", type: "uint256" }, { name: "totalDisbursed", type: "uint256" }] },
  { type: "event", name: "EmployeePaid", inputs: [{ name: "employeeId", type: "bytes32", indexed: true }, { name: "employee", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
  { type: "event", name: "EmployeeAdded", inputs: [{ name: "employeeId", type: "bytes32", indexed: true }, { name: "employee", type: "address", indexed: true }] },
  { type: "event", name: "EmployeeRemoved", inputs: [{ name: "employeeId", type: "bytes32", indexed: true }] },
] as const;

// CrossChainDisbursement ABI (subset)
export const disbursementAbi = [
  { type: "function", name: "receivers", inputs: [{ name: "chainSelector", type: "uint64" }], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "setReceiver", inputs: [{ name: "chainSelector", type: "uint64" }, { name: "receiver", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "estimateFee", inputs: [{ name: "destinationChainSelector", type: "uint64" }, { name: "employeeId", type: "bytes32" }, { name: "employee", type: "address" }, { name: "salaryAmount", type: "uint256" }, { name: "paymentToken", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "ENGINE_ROLE", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  { type: "function", name: "grantRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;

// PayrollReceiver ABI (subset)
export const receiverAbi = [
  { type: "function", name: "getDisbursementCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "getDisbursements", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
    outputs: [{
      type: "tuple[]", components: [
        { name: "messageId", type: "bytes32" },
        { name: "sourceChainSelector", type: "uint64" },
        { name: "employeeId", type: "bytes32" },
        { name: "employee", type: "address" },
        { name: "salaryAmount", type: "uint256" },
        { name: "paymentToken", type: "address" },
        { name: "timestamp", type: "uint256" },
      ],
    }],
    stateMutability: "view",
  },
  { type: "function", name: "getTokenBalance", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "authorizedSender", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "sourceChainSelector", inputs: [], outputs: [{ type: "uint64" }], stateMutability: "view" },
  { type: "function", name: "setAuthorizedSender", inputs: [{ name: "_authorizedSender", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;

// MockUSDC ABI (subset)
export const usdcAbi = [
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const;

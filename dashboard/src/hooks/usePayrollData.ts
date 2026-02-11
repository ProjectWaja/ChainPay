"use client";

import { useReadContracts, useBlockNumber } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ENGINE_ADDRESS,
  RECEIVER_ADDRESS,
  USDC_ADDRESS,
  engineAbi,
  receiverAbi,
} from "@/lib/contracts";

export function usePayrollData() {
  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data, isLoading, error, queryKey } = useReadContracts({
    contracts: [
      { address: ENGINE_ADDRESS, abi: engineAbi, functionName: "getEmployeeCount" },
      { address: ENGINE_ADDRESS, abi: engineAbi, functionName: "getEngineBalance" },
      { address: ENGINE_ADDRESS, abi: engineAbi, functionName: "totalPayrollRuns" },
      { address: ENGINE_ADDRESS, abi: engineAbi, functionName: "getAllEmployeeIds" },
      { address: ENGINE_ADDRESS, abi: engineAbi, functionName: "getPaymentsDueNow" },
      { address: ENGINE_ADDRESS, abi: engineAbi, functionName: "crossChainModule" },
      { address: RECEIVER_ADDRESS, abi: receiverAbi, functionName: "getDisbursementCount" },
      { address: RECEIVER_ADDRESS, abi: receiverAbi, functionName: "getTokenBalance", args: [USDC_ADDRESS] },
    ],
  });

  // Refetch on new blocks
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [blockNumber, queryClient, queryKey]);

  return {
    employeeCount: data?.[0]?.result as bigint | undefined,
    engineBalance: data?.[1]?.result as bigint | undefined,
    totalPayrollRuns: data?.[2]?.result as bigint | undefined,
    employeeIds: data?.[3]?.result as `0x${string}`[] | undefined,
    paymentsDueNow: data?.[4]?.result as `0x${string}`[] | undefined,
    crossChainModule: data?.[5]?.result as `0x${string}` | undefined,
    disbursementCount: data?.[6]?.result as bigint | undefined,
    receiverBalance: data?.[7]?.result as bigint | undefined,
    isLoading,
    error,
  };
}

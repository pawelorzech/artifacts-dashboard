"use client";

import { useQuery } from "@tanstack/react-query";
import { getBank } from "@/lib/api-client";
import type { BankData } from "@/lib/types";

export function useBank() {
  return useQuery<BankData>({
    queryKey: ["bank"],
    queryFn: getBank,
    refetchInterval: 10000,
  });
}

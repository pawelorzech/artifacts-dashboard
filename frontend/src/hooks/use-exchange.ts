"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getExchangeOrders,
  getExchangeHistory,
  getPriceHistory,
} from "@/lib/api-client";
import type { GEOrder, PricePoint } from "@/lib/types";

export function useExchangeOrders() {
  return useQuery<GEOrder[]>({
    queryKey: ["exchange", "orders"],
    queryFn: getExchangeOrders,
    refetchInterval: 10000,
  });
}

export function useExchangeHistory() {
  return useQuery<GEOrder[]>({
    queryKey: ["exchange", "history"],
    queryFn: getExchangeHistory,
    refetchInterval: 30000,
  });
}

export function usePriceHistory(itemCode: string) {
  return useQuery<PricePoint[]>({
    queryKey: ["exchange", "prices", itemCode],
    queryFn: () => getPriceHistory(itemCode),
    enabled: !!itemCode,
    refetchInterval: 30000,
  });
}

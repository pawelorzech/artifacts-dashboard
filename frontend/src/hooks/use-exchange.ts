"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getExchangeOrders,
  getMyOrders,
  getExchangeHistory,
  getSellHistory,
  getPriceHistory,
} from "@/lib/api-client";
import type { GEOrder, GEHistoryEntry, PricePoint } from "@/lib/types";

export function useExchangeOrders() {
  return useQuery<GEOrder[]>({
    queryKey: ["exchange", "orders"],
    queryFn: getExchangeOrders,
    refetchInterval: 10000,
  });
}

export function useMyOrders() {
  return useQuery<GEOrder[]>({
    queryKey: ["exchange", "my-orders"],
    queryFn: getMyOrders,
    refetchInterval: 10000,
  });
}

export function useExchangeHistory() {
  return useQuery<GEHistoryEntry[]>({
    queryKey: ["exchange", "history"],
    queryFn: getExchangeHistory,
    refetchInterval: 30000,
  });
}

export function useSellHistory(itemCode: string) {
  return useQuery<GEHistoryEntry[]>({
    queryKey: ["exchange", "sell-history", itemCode],
    queryFn: () => getSellHistory(itemCode),
    enabled: !!itemCode,
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

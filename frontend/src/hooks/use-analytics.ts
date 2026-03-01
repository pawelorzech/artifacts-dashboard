"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getLogs } from "@/lib/api-client";
import type { AnalyticsData, PaginatedLogs } from "@/lib/types";

export function useAnalytics(characterName?: string, hours?: number) {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics", characterName, hours],
    queryFn: () => getAnalytics(characterName, hours),
    refetchInterval: 30000,
  });
}

export function useLogs(filters?: {
  character?: string;
  type?: string;
  page?: number;
  size?: number;
}) {
  return useQuery<PaginatedLogs>({
    queryKey: ["logs", filters?.character, filters?.type, filters?.page, filters?.size],
    queryFn: () =>
      getLogs({
        character: filters?.character,
        type: filters?.type,
        page: filters?.page,
        size: filters?.size,
      }),
    refetchInterval: 5000,
  });
}

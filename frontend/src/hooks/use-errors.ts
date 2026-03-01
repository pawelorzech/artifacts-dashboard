"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAppErrors,
  getErrorStats,
  resolveError,
} from "@/lib/api-client";
import type { PaginatedErrors, ErrorStats, AppError } from "@/lib/types";

export function useErrors(filters?: {
  severity?: string;
  source?: string;
  resolved?: string;
  page?: number;
  size?: number;
}) {
  return useQuery<PaginatedErrors>({
    queryKey: [
      "app-errors",
      filters?.severity,
      filters?.source,
      filters?.resolved,
      filters?.page,
      filters?.size,
    ],
    queryFn: () => getAppErrors(filters),
    refetchInterval: 15000,
  });
}

export function useErrorStats() {
  return useQuery<ErrorStats>({
    queryKey: ["app-errors-stats"],
    queryFn: getErrorStats,
    refetchInterval: 15000,
  });
}

export function useResolveError() {
  const queryClient = useQueryClient();
  return useMutation<AppError, Error, number>({
    mutationFn: resolveError,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-errors"] });
      queryClient.invalidateQueries({ queryKey: ["app-errors-stats"] });
    },
  });
}

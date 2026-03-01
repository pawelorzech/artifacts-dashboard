"use client";

import { useQuery } from "@tanstack/react-query";
import { getEvents, getEventHistory } from "@/lib/api-client";
import type { ActiveGameEvent, HistoricalEvent } from "@/lib/types";

export function useEvents() {
  return useQuery<ActiveGameEvent[]>({
    queryKey: ["events"],
    queryFn: getEvents,
    refetchInterval: 10000,
  });
}

export function useEventHistory() {
  return useQuery<HistoricalEvent[]>({
    queryKey: ["events", "history"],
    queryFn: getEventHistory,
    refetchInterval: 30000,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { getCharacters, getCharacter, getDashboard } from "@/lib/api-client";
import type { Character, DashboardData } from "@/lib/types";

export function useCharacters() {
  return useQuery<Character[]>({
    queryKey: ["characters"],
    queryFn: getCharacters,
    refetchInterval: 5000,
  });
}

export function useCharacter(name: string) {
  return useQuery<Character>({
    queryKey: ["character", name],
    queryFn: () => getCharacter(name),
    refetchInterval: 5000,
    enabled: !!name,
  });
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    refetchInterval: 5000,
  });
}

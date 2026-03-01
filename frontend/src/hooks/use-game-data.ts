"use client";

import { useQuery } from "@tanstack/react-query";
import { getItems, getMonsters, getResources, getMaps } from "@/lib/api-client";
import type { Item, Monster, Resource, MapTile } from "@/lib/types";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useItems() {
  return useQuery<Item[]>({
    queryKey: ["game", "items"],
    queryFn: getItems,
    staleTime: FIVE_MINUTES,
  });
}

export function useMonsters() {
  return useQuery<Monster[]>({
    queryKey: ["game", "monsters"],
    queryFn: getMonsters,
    staleTime: FIVE_MINUTES,
  });
}

export function useResources() {
  return useQuery<Resource[]>({
    queryKey: ["game", "resources"],
    queryFn: getResources,
    staleTime: FIVE_MINUTES,
  });
}

export function useMaps() {
  return useQuery<MapTile[]>({
    queryKey: ["game", "maps"],
    queryFn: getMaps,
    staleTime: FIVE_MINUTES,
  });
}

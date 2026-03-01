"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAutomations,
  getAutomation,
  getAutomationStatuses,
  getAutomationLogs,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  startAutomation,
  stopAutomation,
  pauseAutomation,
  resumeAutomation,
} from "@/lib/api-client";
import type {
  AutomationConfig,
  AutomationRun,
  AutomationLog,
  AutomationStatus,
} from "@/lib/types";

export function useAutomations() {
  return useQuery<AutomationConfig[]>({
    queryKey: ["automations"],
    queryFn: getAutomations,
    refetchInterval: 5000,
  });
}

export function useAutomation(id: number) {
  return useQuery<{ config: AutomationConfig; runs: AutomationRun[] }>({
    queryKey: ["automation", id],
    queryFn: () => getAutomation(id),
    refetchInterval: 5000,
    enabled: id > 0,
  });
}

export function useAutomationStatuses() {
  return useQuery<AutomationStatus[]>({
    queryKey: ["automationStatuses"],
    queryFn: getAutomationStatuses,
    refetchInterval: 3000,
  });
}

export function useAutomationLogs(id: number) {
  return useQuery<AutomationLog[]>({
    queryKey: ["automationLogs", id],
    queryFn: () => getAutomationLogs(id),
    refetchInterval: 3000,
    enabled: id > 0,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      character_name: string;
      strategy_type: string;
      config: Record<string, unknown>;
    }) => createAutomation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<AutomationConfig>;
    }) => updateAutomation(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      queryClient.invalidateQueries({
        queryKey: ["automation", variables.id],
      });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });
}

export function useControlAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number;
      action: "start" | "stop" | "pause" | "resume";
    }) => {
      switch (action) {
        case "start":
          return startAutomation(id);
        case "stop":
          return stopAutomation(id);
        case "pause":
          return pauseAutomation(id);
        case "resume":
          return resumeAutomation(id);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      queryClient.invalidateQueries({
        queryKey: ["automation", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["automationStatuses"] });
      queryClient.invalidateQueries({
        queryKey: ["automationLogs", variables.id],
      });
    },
  });
}

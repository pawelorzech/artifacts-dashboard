"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkflows,
  getWorkflow,
  getWorkflowStatuses,
  getWorkflowLogs,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  startWorkflow,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
} from "@/lib/api-client";
import type {
  WorkflowConfig,
  WorkflowRun,
  WorkflowStatus,
  AutomationLog,
} from "@/lib/types";

export function useWorkflows() {
  return useQuery<WorkflowConfig[]>({
    queryKey: ["workflows"],
    queryFn: getWorkflows,
    refetchInterval: 5000,
  });
}

export function useWorkflow(id: number) {
  return useQuery<{ config: WorkflowConfig; runs: WorkflowRun[] }>({
    queryKey: ["workflow", id],
    queryFn: () => getWorkflow(id),
    refetchInterval: 5000,
    enabled: id > 0,
  });
}

export function useWorkflowStatuses() {
  return useQuery<WorkflowStatus[]>({
    queryKey: ["workflowStatuses"],
    queryFn: getWorkflowStatuses,
    refetchInterval: 3000,
  });
}

export function useWorkflowLogs(id: number) {
  return useQuery<AutomationLog[]>({
    queryKey: ["workflowLogs", id],
    queryFn: () => getWorkflowLogs(id),
    refetchInterval: 3000,
    enabled: id > 0,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      character_name: string;
      description?: string;
      steps: Record<string, unknown>[];
      loop?: boolean;
      max_loops?: number;
    }) => createWorkflow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<WorkflowConfig>;
    }) => updateWorkflow(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow", variables.id],
      });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useControlWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: number;
      action: "start" | "stop" | "pause" | "resume";
    }) => {
      switch (action) {
        case "start":
          await startWorkflow(id);
          return;
        case "stop":
          return stopWorkflow(id);
        case "pause":
          return pauseWorkflow(id);
        case "resume":
          return resumeWorkflow(id);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["workflowStatuses"] });
      queryClient.invalidateQueries({
        queryKey: ["workflowLogs", variables.id],
      });
    },
  });
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPipelines,
  getPipeline,
  getPipelineStatuses,
  getPipelineLogs,
  createPipeline,
  updatePipeline,
  deletePipeline,
  startPipeline,
  stopPipeline,
  pausePipeline,
  resumePipeline,
} from "@/lib/api-client";
import type {
  PipelineConfig,
  PipelineRun,
  PipelineStatus,
  AutomationLog,
} from "@/lib/types";

export function usePipelines() {
  return useQuery<PipelineConfig[]>({
    queryKey: ["pipelines"],
    queryFn: getPipelines,
    refetchInterval: 5000,
  });
}

export function usePipeline(id: number) {
  return useQuery<{ config: PipelineConfig; runs: PipelineRun[] }>({
    queryKey: ["pipeline", id],
    queryFn: () => getPipeline(id),
    refetchInterval: 5000,
    enabled: id > 0,
  });
}

export function usePipelineStatuses() {
  return useQuery<PipelineStatus[]>({
    queryKey: ["pipelineStatuses"],
    queryFn: getPipelineStatuses,
    refetchInterval: 3000,
  });
}

export function usePipelineLogs(id: number) {
  return useQuery<AutomationLog[]>({
    queryKey: ["pipelineLogs", id],
    queryFn: () => getPipelineLogs(id),
    refetchInterval: 3000,
    enabled: id > 0,
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      stages: Record<string, unknown>[];
      loop?: boolean;
      max_loops?: number;
    }) => createPipeline(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<PipelineConfig>;
    }) => updatePipeline(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({
        queryKey: ["pipeline", variables.id],
      });
    },
  });
}

export function useDeletePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePipeline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

export function useControlPipeline() {
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
          await startPipeline(id);
          return;
        case "stop":
          return stopPipeline(id);
        case "pause":
          return pausePipeline(id);
        case "resume":
          return resumePipeline(id);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({
        queryKey: ["pipeline", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["pipelineStatuses"] });
      queryClient.invalidateQueries({
        queryKey: ["pipelineLogs", variables.id],
      });
    },
  });
}

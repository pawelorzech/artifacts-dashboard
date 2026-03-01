"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Bot,
  Play,
  Square,
  Pause,
  Repeat,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  usePipelines,
  usePipelineStatuses,
  useDeletePipeline,
  useControlPipeline,
} from "@/hooks/use-pipelines";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
  }
> = {
  running: {
    label: "Running",
    variant: "default",
    className: "bg-green-600 hover:bg-green-600 text-white",
  },
  paused: {
    label: "Paused",
    variant: "default",
    className: "bg-yellow-600 hover:bg-yellow-600 text-white",
  },
  stopped: { label: "Stopped", variant: "secondary", className: "" },
  completed: {
    label: "Completed",
    variant: "default",
    className: "bg-blue-600 hover:bg-blue-600 text-white",
  },
  error: { label: "Error", variant: "destructive", className: "" },
};

function getUniqueCharacters(stages: { character_steps?: { character_name: string }[] }[]): string[] {
  const names = new Set<string>();
  for (const stage of stages) {
    for (const cs of stage.character_steps ?? []) {
      names.add(cs.character_name);
    }
  }
  return Array.from(names).sort();
}

export function PipelineList() {
  const router = useRouter();
  const { data: pipelines, isLoading, error } = usePipelines();
  const { data: statuses } = usePipelineStatuses();
  const deleteMutation = useDeletePipeline();
  const control = useControlPipeline();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const statusMap = new Map(
    (statuses ?? []).map((s) => [s.pipeline_id, s])
  );

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`Pipeline "${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(`Failed to delete: ${err.message}`);
      },
    });
  }

  function handleControl(
    id: number,
    action: "start" | "stop" | "pause" | "resume"
  ) {
    control.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(`Pipeline ${action}ed`),
        onError: (err) =>
          toast.error(`Failed to ${action} pipeline: ${err.message}`),
      }
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10 p-4">
        <p className="text-sm text-destructive">
          Failed to load pipelines. Make sure the backend is running.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="size-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">
          No pipelines configured yet. Create a multi-character pipeline to
          coordinate characters across stages.
        </p>
        <Button onClick={() => router.push("/automations/pipelines/new")}>
          <Plus className="size-4" />
          Create Pipeline
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Characters</TableHead>
              <TableHead>Stages</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Controls</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pipelines.map((pl) => {
              const status = statusMap.get(pl.id);
              const currentStatus = status?.status ?? "stopped";
              const statusCfg =
                STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.stopped;
              const isStopped =
                currentStatus === "stopped" ||
                currentStatus === "completed" ||
                currentStatus === "error" ||
                !currentStatus;
              const isRunning = currentStatus === "running";
              const isPaused = currentStatus === "paused";
              const characters = getUniqueCharacters(pl.stages);

              return (
                <TableRow
                  key={pl.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/automations/pipelines/${pl.id}`)
                  }
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {pl.name}
                      {pl.loop && (
                        <Repeat className="size-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {characters.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {pl.stages.length} stage{pl.stages.length !== 1 && "s"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusCfg.variant}
                      className={statusCfg.className}
                    >
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {status ? (
                      <span>
                        Stage {status.current_stage_index + 1}/
                        {status.total_stages}
                        {status.loop_count > 0 && (
                          <> &middot; Loop {status.loop_count}</>
                        )}
                        {" "}&middot; {status.total_actions_count} actions
                      </span>
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {isStopped && (
                        <Button
                          size="xs"
                          variant="outline"
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          onClick={() => handleControl(pl.id, "start")}
                          disabled={control.isPending}
                        >
                          <Play className="size-3" />
                        </Button>
                      )}
                      {isRunning && (
                        <>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                            onClick={() => handleControl(pl.id, "pause")}
                            disabled={control.isPending}
                          >
                            <Pause className="size-3" />
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleControl(pl.id, "stop")}
                            disabled={control.isPending}
                          >
                            <Square className="size-3" />
                          </Button>
                        </>
                      )}
                      {isPaused && (
                        <>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            onClick={() => handleControl(pl.id, "resume")}
                            disabled={control.isPending}
                          >
                            <Play className="size-3" />
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleControl(pl.id, "stop")}
                            disabled={control.isPending}
                          >
                            <Square className="size-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setDeleteTarget({ id: pl.id, name: pl.name })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pipeline</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}
              &rdquo;? This action cannot be undone. Any running pipeline will be
              stopped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Repeat,
  Play,
  Square,
  Pause,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  useWorkflow,
  useWorkflowStatuses,
  useWorkflowLogs,
  useControlWorkflow,
} from "@/hooks/use-workflows";
import { WorkflowProgress } from "@/components/workflow/workflow-progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  running: "bg-green-600 text-white",
  paused: "bg-yellow-600 text-white",
  stopped: "",
  completed: "bg-blue-600 text-white",
  error: "bg-red-600 text-white",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function formatDuration(start: string, end: string | null): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = endTime - startTime;
  const diffS = Math.floor(diffMs / 1000);

  if (diffS < 60) return `${diffS}s`;
  const m = Math.floor(diffS / 60);
  const s = diffS % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const id = parseInt(idStr, 10);
  const router = useRouter();

  const { data, isLoading, error } = useWorkflow(id);
  const { data: statuses } = useWorkflowStatuses();
  const { data: logs } = useWorkflowLogs(id);
  const control = useControlWorkflow();

  const status = statuses?.find((s) => s.workflow_id === id) ?? null;
  const currentStatus = status?.status ?? "stopped";

  const isStopped =
    currentStatus === "stopped" ||
    currentStatus === "completed" ||
    currentStatus === "error" ||
    !currentStatus;
  const isRunning = currentStatus === "running";
  const isPaused = currentStatus === "paused";

  function handleControl(action: "start" | "stop" | "pause" | "resume") {
    control.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(`Workflow ${action}ed`),
        onError: (err) =>
          toast.error(`Failed to ${action} workflow: ${err.message}`),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/automations")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load workflow. It may have been deleted.
          </p>
        </Card>
      </div>
    );
  }

  const { config: workflow, runs } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="mt-1"
          onClick={() => router.push("/automations")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {workflow.name}
            </h1>
            {workflow.loop && (
              <Badge variant="outline" className="gap-1">
                <Repeat className="size-3" />
                Loop
                {workflow.max_loops > 0 && ` (max ${workflow.max_loops})`}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {workflow.character_name} &middot; {workflow.steps.length} step
            {workflow.steps.length !== 1 && "s"}
            {workflow.description && ` &middot; ${workflow.description}`}
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge
            variant={
              currentStatus === "error"
                ? "destructive"
                : currentStatus === "running"
                  ? "default"
                  : "secondary"
            }
            className={STATUS_BADGE_CLASSES[currentStatus] ?? ""}
          >
            {control.isPending && (
              <Loader2 className="size-3 animate-spin" />
            )}
            {currentStatus}
          </Badge>

          {status && (
            <span className="text-xs text-muted-foreground">
              {status.total_actions_count.toLocaleString()} actions
            </span>
          )}

          <div className="flex items-center gap-1.5">
            {isStopped && (
              <Button
                size="xs"
                variant="outline"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                onClick={() => handleControl("start")}
                disabled={control.isPending}
              >
                <Play className="size-3" />
                Start
              </Button>
            )}
            {isRunning && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                  onClick={() => handleControl("pause")}
                  disabled={control.isPending}
                >
                  <Pause className="size-3" />
                  Pause
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => handleControl("stop")}
                  disabled={control.isPending}
                >
                  <Square className="size-3" />
                  Stop
                </Button>
              </>
            )}
            {isPaused && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  onClick={() => handleControl("resume")}
                  disabled={control.isPending}
                >
                  <Play className="size-3" />
                  Resume
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => handleControl("stop")}
                  disabled={control.isPending}
                >
                  <Square className="size-3" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <WorkflowProgress
            steps={workflow.steps}
            status={status}
            logs={logs ?? []}
            loop={workflow.loop}
            maxLoops={workflow.max_loops}
          />
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No runs yet. Start the workflow to create a run.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Loops</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          <Badge
                            variant={
                              run.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                            className={cn(
                              STATUS_BADGE_CLASSES[run.status]
                            )}
                          >
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {formatDate(run.started_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDuration(run.started_at, run.stopped_at)}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {run.current_step_index + 1}/{workflow.steps.length}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {run.loop_count}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {run.total_actions_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {run.error_message && (
                            <span className="text-xs text-red-400 truncate block">
                              {run.error_message}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, AlertCircle, Loader2, Play, Square, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PipelineConfig, PipelineStatus } from "@/lib/types";
import { useControlPipeline } from "@/hooks/use-pipelines";
import { toast } from "sonner";

interface PipelineProgressProps {
  config: PipelineConfig;
  status: PipelineStatus | null;
}

const CHAR_STATUS_ICONS: Record<string, React.ReactNode> = {
  running: <Loader2 className="size-3 animate-spin text-green-400" />,
  completed: <CheckCircle2 className="size-3 text-blue-400" />,
  error: <AlertCircle className="size-3 text-red-400" />,
  idle: <Circle className="size-3 text-muted-foreground" />,
};

export function PipelineProgress({ config, status }: PipelineProgressProps) {
  const control = useControlPipeline();
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
      { id: config.id, action },
      {
        onSuccess: () => toast.success(`Pipeline ${action}ed`),
        onError: (err) =>
          toast.error(`Failed to ${action}: ${err.message}`),
      }
    );
  }

  // Build a map of character states from the status
  const charStateMap = new Map(
    (status?.character_states ?? []).map((cs) => [cs.character_name, cs])
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Live Progress</CardTitle>
          <div className="flex items-center gap-2">
            {status && (
              <span className="text-xs text-muted-foreground">
                {status.total_actions_count} total actions
                {status.loop_count > 0 && ` \u00b7 Loop ${status.loop_count}`}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {isStopped && (
                <Button
                  size="xs"
                  variant="outline"
                  className="text-green-400"
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
                    className="text-yellow-400"
                    onClick={() => handleControl("pause")}
                    disabled={control.isPending}
                  >
                    <Pause className="size-3" />
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-red-400"
                    onClick={() => handleControl("stop")}
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
                    className="text-green-400"
                    onClick={() => handleControl("resume")}
                    disabled={control.isPending}
                  >
                    <Play className="size-3" />
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-red-400"
                    onClick={() => handleControl("stop")}
                    disabled={control.isPending}
                  >
                    <Square className="size-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {config.stages.map((stage, idx) => {
            const isActive =
              status != null && status.current_stage_index === idx && isRunning;
            const isCompleted =
              status != null && status.current_stage_index > idx;
            const isPastOrActive = isActive || isCompleted;

            return (
              <div key={stage.id} className="relative flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`size-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? "border-green-500 bg-green-500/20 text-green-400"
                        : isCompleted
                          ? "border-blue-500 bg-blue-500/20 text-blue-400"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : isActive ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < config.stages.length - 1 && (
                    <div
                      className={`w-0.5 flex-1 min-h-4 ${
                        isPastOrActive
                          ? "bg-blue-500/50"
                          : "bg-muted-foreground/20"
                      }`}
                    />
                  )}
                </div>

                {/* Stage content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-green-400"
                          : isCompleted
                            ? "text-blue-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {stage.name}
                    </span>
                    {isActive && (
                      <Badge className="bg-green-600 text-white text-[10px] px-1.5">
                        Active
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge className="bg-blue-600 text-white text-[10px] px-1.5">
                        Done
                      </Badge>
                    )}
                  </div>

                  {/* Character workers */}
                  <div className="space-y-1">
                    {stage.character_steps.map((cs) => {
                      const charState = charStateMap.get(cs.character_name);
                      const charStatus = charState?.status ?? "idle";

                      return (
                        <div
                          key={cs.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          {isActive
                            ? CHAR_STATUS_ICONS[charStatus] ??
                              CHAR_STATUS_ICONS.idle
                            : <Circle className="size-3 text-muted-foreground/40" />}
                          <span
                            className={
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {cs.character_name || "Unassigned"}
                          </span>
                          <span className="text-muted-foreground capitalize">
                            {cs.strategy_type}
                          </span>
                          {isActive && charState && (
                            <span className="text-muted-foreground">
                              {charState.actions_count} actions
                            </span>
                          )}
                          {charState?.error && (
                            <span className="text-red-400 truncate max-w-48">
                              {charState.error}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

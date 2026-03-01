"use client";

import { Play, Square, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useControlAutomation } from "@/hooks/use-automations";
import { toast } from "sonner";

interface RunControlsProps {
  automationId: number;
  status: string;
  actionsCount: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
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
  stopped: {
    label: "Stopped",
    variant: "secondary",
    className: "",
  },
  error: {
    label: "Error",
    variant: "destructive",
    className: "",
  },
};

export function RunControls({
  automationId,
  status,
  actionsCount,
}: RunControlsProps) {
  const control = useControlAutomation();
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped;

  function handleControl(action: "start" | "stop" | "pause" | "resume") {
    control.mutate(
      { id: automationId, action },
      {
        onSuccess: () => {
          toast.success(
            `Automation ${action === "start" ? "started" : action === "stop" ? "stopped" : action === "pause" ? "paused" : "resumed"} successfully`
          );
        },
        onError: (error) => {
          toast.error(`Failed to ${action} automation: ${error.message}`);
        },
      }
    );
  }

  const isStopped = status === "stopped" || status === "error" || !status;
  const isRunning = status === "running";
  const isPaused = status === "paused";

  return (
    <div className="flex items-center gap-3">
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        {control.isPending && (
          <Loader2 className="size-3 animate-spin" />
        )}
        {statusConfig.label}
      </Badge>

      <span className="text-xs text-muted-foreground">
        {actionsCount.toLocaleString()} actions
      </span>

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
  );
}

"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Repeat,
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkflowStep, WorkflowStatus, AutomationLog } from "@/lib/types";
import { LogStream } from "@/components/automation/log-stream";
import { cn } from "@/lib/utils";

const STRATEGY_ICONS: Record<string, React.ElementType> = {
  combat: Swords,
  gathering: Pickaxe,
  crafting: Hammer,
  trading: TrendingUp,
  task: ClipboardList,
  leveling: GraduationCap,
};

const STRATEGY_COLORS: Record<string, string> = {
  combat: "text-red-400",
  gathering: "text-green-400",
  crafting: "text-blue-400",
  trading: "text-yellow-400",
  task: "text-purple-400",
  leveling: "text-cyan-400",
};

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  status: WorkflowStatus | null;
  logs: AutomationLog[];
  loop: boolean;
  maxLoops: number;
}

export function WorkflowProgress({
  steps,
  status,
  logs,
  loop,
  maxLoops,
}: WorkflowProgressProps) {
  const currentIndex = status?.current_step_index ?? 0;
  const isRunning = status?.status === "running";
  const isPaused = status?.status === "paused";
  const isActive = isRunning || isPaused;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {status && (
          <>
            <span className="text-muted-foreground">
              Step{" "}
              <strong className="text-foreground">
                {currentIndex + 1}/{steps.length}
              </strong>
            </span>
            {loop && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Repeat className="size-3" />
                Loop{" "}
                <strong className="text-foreground">
                  {status.loop_count}
                  {maxLoops > 0 && `/${maxLoops}`}
                </strong>
              </span>
            )}
            <span className="text-muted-foreground">
              Actions:{" "}
              <strong className="text-foreground">
                {status.total_actions_count.toLocaleString()}
              </strong>
            </span>
            {status.strategy_state && (
              <Badge variant="outline" className="text-xs">
                {status.strategy_state}
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Step timeline */}
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const isCompleted = isActive && idx < currentIndex;
          const isCurrent = isActive && idx === currentIndex;
          const isPending = !isActive || idx > currentIndex;
          const Icon = STRATEGY_ICONS[step.strategy_type] ?? Circle;
          const color = STRATEGY_COLORS[step.strategy_type] ?? "text-muted-foreground";

          return (
            <div key={step.id} className="flex items-stretch gap-3">
              {/* Vertical connector */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                    isCompleted &&
                      "bg-green-600/20 border-green-600 text-green-400",
                    isCurrent &&
                      "bg-primary/20 border-primary text-primary animate-pulse",
                    isPending &&
                      "bg-muted/50 border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-4" />
                  ) : isCurrent && isRunning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Icon className={cn("size-4", isCurrent ? "" : isPending ? "opacity-50" : color)} />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-4",
                      isCompleted ? "bg-green-600/50" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div
                className={cn(
                  "flex-1 pb-4",
                  isPending && "opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCurrent && "text-primary"
                    )}
                  >
                    {step.name || `Step ${idx + 1}`}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {step.strategy_type}
                  </Badge>
                  {isCurrent && status && (
                    <span className="text-xs text-muted-foreground">
                      ({status.step_actions_count} actions)
                    </span>
                  )}
                </div>
                {step.transition && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Transition: {step.transition.type.replace(/_/g, " ")}
                    {step.transition.operator && ` ${step.transition.operator}`}
                    {step.transition.value !== undefined &&
                      ` ${step.transition.value}`}
                    {step.transition.item_code &&
                      ` (${step.transition.item_code})`}
                    {step.transition.skill && ` (${step.transition.skill})`}
                    {step.transition.seconds !== undefined &&
                      step.transition.type === "timer" &&
                      ` ${step.transition.seconds}s`}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Loop indicator */}
        {loop && (
          <div className="flex items-center gap-3 pl-3">
            <Repeat className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Loop back to Step 1
              {maxLoops > 0 && ` (max ${maxLoops} loops)`}
            </span>
          </div>
        )}
      </div>

      {/* Live logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <LogStream logs={logs} maxHeight="400px" />
        </CardContent>
      </Card>
    </div>
  );
}

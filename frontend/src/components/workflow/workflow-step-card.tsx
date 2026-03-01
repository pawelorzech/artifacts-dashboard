"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Trash2,
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StrategySelector } from "@/components/automation/strategy-selector";
import {
  ConfigForm,
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_GATHERING_CONFIG,
  DEFAULT_CRAFTING_CONFIG,
  DEFAULT_TRADING_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_LEVELING_CONFIG,
} from "@/components/automation/config-form";
import { TransitionEditor } from "@/components/workflow/transition-editor";
import type { WorkflowStep, TransitionCondition } from "@/lib/types";
import { cn } from "@/lib/utils";

type StrategyType =
  | "combat"
  | "gathering"
  | "crafting"
  | "trading"
  | "task"
  | "leveling";

const STRATEGY_META: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  combat: { icon: Swords, color: "text-red-400", label: "Combat" },
  gathering: { icon: Pickaxe, color: "text-green-400", label: "Gathering" },
  crafting: { icon: Hammer, color: "text-blue-400", label: "Crafting" },
  trading: { icon: TrendingUp, color: "text-yellow-400", label: "Trading" },
  task: { icon: ClipboardList, color: "text-purple-400", label: "Task" },
  leveling: { icon: GraduationCap, color: "text-cyan-400", label: "Leveling" },
};

const DEFAULT_CONFIGS: Record<StrategyType, Record<string, unknown>> = {
  combat: DEFAULT_COMBAT_CONFIG as unknown as Record<string, unknown>,
  gathering: DEFAULT_GATHERING_CONFIG as unknown as Record<string, unknown>,
  crafting: DEFAULT_CRAFTING_CONFIG as unknown as Record<string, unknown>,
  trading: DEFAULT_TRADING_CONFIG as unknown as Record<string, unknown>,
  task: DEFAULT_TASK_CONFIG as unknown as Record<string, unknown>,
  leveling: DEFAULT_LEVELING_CONFIG as unknown as Record<string, unknown>,
};

function configSummary(step: WorkflowStep): string {
  const c = step.config;
  switch (step.strategy_type) {
    case "combat":
      return c.monster_code
        ? `${c.monster_code}`
        : "auto-select";
    case "gathering":
      return c.resource_code
        ? `${c.resource_code}`
        : "auto-select";
    case "crafting":
      return c.item_code
        ? `${c.item_code} x${c.quantity ?? 1}`
        : "no item set";
    case "trading":
      return `${c.mode ?? "sell_loot"} ${c.item_code ?? ""}`.trim();
    case "task":
      return "auto tasks";
    case "leveling":
      return c.target_skill ? `${c.target_skill}` : "auto";
    default:
      return "";
  }
}

function transitionBadge(t: TransitionCondition | null): string {
  if (!t) return "run to completion";
  switch (t.type) {
    case "strategy_complete":
      return "on complete";
    case "inventory_full":
      return "inv full";
    case "actions_count":
      return `${t.operator} ${t.value} actions`;
    case "skill_level":
      return `${t.skill} ${t.operator} ${t.value}`;
    case "inventory_item_count":
      return `inv ${t.item_code} ${t.operator} ${t.value}`;
    case "bank_item_count":
      return `bank ${t.item_code} ${t.operator} ${t.value}`;
    case "gold_amount":
      return `gold ${t.operator} ${t.value}`;
    case "timer":
      return `${t.seconds}s timer`;
    default:
      return t.type;
  }
}

interface WorkflowStepCardProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  onChange: (step: WorkflowStep) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function WorkflowStepCard({
  step,
  index,
  totalSteps,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: WorkflowStepCardProps) {
  const [expanded, setExpanded] = useState(!step.strategy_type);
  const meta = STRATEGY_META[step.strategy_type];
  const Icon = meta?.icon ?? ClipboardList;

  function updateStep(partial: Partial<WorkflowStep>) {
    onChange({ ...step, ...partial });
  }

  function handleStrategyChange(strategy: StrategyType) {
    onChange({
      ...step,
      strategy_type: strategy,
      config: DEFAULT_CONFIGS[strategy],
      name: step.name || `${STRATEGY_META[strategy]?.label ?? strategy} Step`,
    });
  }

  return (
    <Card className="overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
          {index + 1}
        </span>
        <Icon className={cn("size-4 shrink-0", meta?.color)} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">
            {step.name || "Untitled Step"}
          </span>
          <span className="text-xs text-muted-foreground truncate block">
            {meta?.label ?? step.strategy_type} &middot; {configSummary(step)}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {transitionBadge(step.transition)}
        </Badge>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-5">
          {/* Step name */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Step Name</Label>
            <Input
              className="h-8 text-sm"
              value={step.name}
              placeholder="e.g. Gather Copper Ore"
              onChange={(e) => updateStep({ name: e.target.value })}
            />
          </div>

          {/* Strategy selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Strategy</Label>
            <StrategySelector
              value={step.strategy_type}
              onChange={handleStrategyChange}
            />
          </div>

          {/* Config form */}
          {step.strategy_type && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Configuration
              </Label>
              <ConfigForm
                strategyType={step.strategy_type}
                config={step.config}
                onChange={(config) => updateStep({ config })}
              />
            </div>
          )}

          {/* Transition editor */}
          <TransitionEditor
            value={step.transition}
            onChange={(transition) => updateStep({ transition })}
          />

          {/* Reorder / Delete controls */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="xs"
              variant="outline"
              disabled={index === 0}
              onClick={onMoveUp}
            >
              <ArrowUp className="size-3" />
              Up
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={index === totalSteps - 1}
              onClick={onMoveDown}
            >
              <ArrowDown className="size-3" />
              Down
            </Button>
            <div className="flex-1" />
            <Button
              size="xs"
              variant="outline"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={onDelete}
            >
              <Trash2 className="size-3" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

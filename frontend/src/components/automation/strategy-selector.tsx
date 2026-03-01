"use client";

import { Swords, Pickaxe, Hammer, TrendingUp, ClipboardList, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  {
    type: "combat" as const,
    label: "Combat",
    description:
      "Fight monsters automatically. Configure target, healing, and loot management.",
    icon: Swords,
    color: "text-red-400",
    borderColor: "border-red-500/50",
    bgColor: "bg-red-500/10",
  },
  {
    type: "gathering" as const,
    label: "Gathering",
    description:
      "Gather resources automatically. Configure resource type and inventory management.",
    icon: Pickaxe,
    color: "text-green-400",
    borderColor: "border-green-500/50",
    bgColor: "bg-green-500/10",
  },
  {
    type: "crafting" as const,
    label: "Crafting",
    description:
      "Craft items automatically. Configure item, quantity, and material management.",
    icon: Hammer,
    color: "text-blue-400",
    borderColor: "border-blue-500/50",
    bgColor: "bg-blue-500/10",
  },
  {
    type: "trading" as const,
    label: "Trading",
    description:
      "Trade on the Grand Exchange. Sell loot, buy materials, or flip items for profit.",
    icon: TrendingUp,
    color: "text-yellow-400",
    borderColor: "border-yellow-500/50",
    bgColor: "bg-yellow-500/10",
  },
  {
    type: "task" as const,
    label: "Task",
    description:
      "Complete tasks automatically. Auto-accept and complete available tasks.",
    icon: ClipboardList,
    color: "text-purple-400",
    borderColor: "border-purple-500/50",
    bgColor: "bg-purple-500/10",
  },
  {
    type: "leveling" as const,
    label: "Leveling",
    description:
      "Level up skills efficiently. Optionally focus on a specific skill to train.",
    icon: GraduationCap,
    color: "text-cyan-400",
    borderColor: "border-cyan-500/50",
    bgColor: "bg-cyan-500/10",
  },
] as const;

type StrategyType = (typeof STRATEGIES)[number]["type"];

interface StrategySelectorProps {
  value: string | null;
  onChange: (strategy: StrategyType) => void;
}

export function StrategySelector({ value, onChange }: StrategySelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {STRATEGIES.map((strategy) => {
        const Icon = strategy.icon;
        const isSelected = value === strategy.type;

        return (
          <Card
            key={strategy.type}
            className={cn(
              "cursor-pointer transition-all py-4",
              isSelected
                ? `${strategy.borderColor} ${strategy.bgColor} ring-1 ring-offset-0 ring-offset-background`
                : "hover:bg-accent/30"
            )}
            onClick={() => onChange(strategy.type)}
          >
            <CardContent className="flex items-start gap-4 px-4 pt-0">
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-lg",
                  strategy.bgColor
                )}
              >
                <Icon className={cn("size-6", strategy.color)} />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">
                  {strategy.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {strategy.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

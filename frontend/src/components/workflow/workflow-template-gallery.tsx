"use client";

import { useRouter } from "next/navigation";
import {
  GitBranch,
  Repeat,
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  WORKFLOW_TEMPLATES,
  WORKFLOW_CATEGORY_LABELS,
  WORKFLOW_CATEGORY_COLORS,
} from "./workflow-templates";
import { cn } from "@/lib/utils";

const STRATEGY_ICONS: Record<string, React.ElementType> = {
  combat: Swords,
  gathering: Pickaxe,
  crafting: Hammer,
  trading: TrendingUp,
  task: ClipboardList,
  leveling: GraduationCap,
};

export function WorkflowTemplateGallery() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Separator />
      <div className="flex items-center gap-2">
        <GitBranch className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Workflow Templates
        </h2>
        <span className="text-sm text-muted-foreground">
          Multi-step pipelines
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WORKFLOW_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer transition-all hover:shadow-md group py-0 overflow-hidden hover:border-primary/30"
            onClick={() =>
              router.push(
                `/automations/workflows/new?template=${template.id}`
              )
            }
          >
            <div className="h-1 bg-primary/40" />
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <GitBranch className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] capitalize",
                    WORKFLOW_CATEGORY_COLORS[template.category]
                  )}
                >
                  {WORKFLOW_CATEGORY_LABELS[template.category] ??
                    template.category}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {template.steps.length} step
                  {template.steps.length !== 1 && "s"}
                </Badge>
                {template.loop && (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-0.5"
                  >
                    <Repeat className="size-2.5" />
                    Loop
                  </Badge>
                )}
              </div>

              {/* Step mini-preview */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {template.steps.map((step, idx) => {
                  const Icon =
                    STRATEGY_ICONS[step.strategy_type] ?? ClipboardList;
                  return (
                    <span key={step.id} className="flex items-center gap-0.5">
                      {idx > 0 && <span className="mx-0.5">&rarr;</span>}
                      <Icon className="size-3" />
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

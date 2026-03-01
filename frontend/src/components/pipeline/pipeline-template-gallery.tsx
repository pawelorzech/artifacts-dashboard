"use client";

import { useRouter } from "next/navigation";
import {
  Network,
  Repeat,
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  PIPELINE_TEMPLATES,
  PIPELINE_CATEGORY_LABELS,
  PIPELINE_CATEGORY_COLORS,
} from "./pipeline-templates";
import { cn } from "@/lib/utils";

const STRATEGY_ICONS: Record<string, React.ElementType> = {
  combat: Swords,
  gathering: Pickaxe,
  crafting: Hammer,
  trading: TrendingUp,
};

export function PipelineTemplateGallery() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Separator />
      <div className="flex items-center gap-2">
        <Network className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Pipeline Templates
        </h2>
        <span className="text-sm text-muted-foreground">
          Multi-character collaboration
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer transition-all hover:shadow-md group py-0 overflow-hidden hover:border-primary/30"
            onClick={() =>
              router.push(
                `/automations/pipelines/new?template=${template.id}`
              )
            }
          >
            <div className="h-1 bg-primary/40" />
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Network className="size-5 text-primary" />
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
                    PIPELINE_CATEGORY_COLORS[template.category]
                  )}
                >
                  {PIPELINE_CATEGORY_LABELS[template.category] ??
                    template.category}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {template.stages.length} stage
                  {template.stages.length !== 1 && "s"}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-0.5">
                  <Users className="size-2.5" />
                  {template.roles.length} roles
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

              {/* Stage mini-preview */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {template.stages.map((stage, idx) => {
                  const strategyTypes = [
                    ...new Set(stage.character_steps.map((cs) => cs.strategy_type)),
                  ];
                  return (
                    <span key={stage.id} className="flex items-center gap-0.5">
                      {idx > 0 && <span className="mx-0.5">&rarr;</span>}
                      {strategyTypes.map((st) => {
                        const Icon = STRATEGY_ICONS[st] ?? Network;
                        return <Icon key={st} className="size-3" />;
                      })}
                      {stage.character_steps.length > 1 && (
                        <span className="text-[9px]">
                          x{stage.character_steps.length}
                        </span>
                      )}
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

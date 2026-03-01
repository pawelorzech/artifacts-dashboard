"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  ClipboardList,
  GraduationCap,
  Bot,
  Zap,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAutomations,
  useAutomationStatuses,
} from "@/hooks/use-automations";
import { RunControls } from "@/components/automation/run-controls";
import {
  GALLERY_TEMPLATES,
  type GalleryTemplate,
} from "@/components/automation/gallery-templates";
import { GalleryActivateDialog } from "@/components/automation/gallery-activate-dialog";
import { cn } from "@/lib/utils";
import type { Character } from "@/lib/types";

const STRATEGY_ICONS: Record<string, typeof Swords> = {
  combat: Swords,
  gathering: Pickaxe,
  crafting: Hammer,
  trading: TrendingUp,
  task: ClipboardList,
  leveling: GraduationCap,
};

const STRATEGY_COLORS: Record<
  string,
  { text: string; bg: string }
> = {
  combat: { text: "text-red-400", bg: "bg-red-500/10" },
  gathering: { text: "text-green-400", bg: "bg-green-500/10" },
  crafting: { text: "text-blue-400", bg: "bg-blue-500/10" },
  trading: { text: "text-yellow-400", bg: "bg-yellow-500/10" },
  task: { text: "text-purple-400", bg: "bg-purple-500/10" },
  leveling: { text: "text-cyan-400", bg: "bg-cyan-500/10" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/10 text-red-400 border-red-500/30",
};

const MAX_SUGGESTIONS = 6;

interface CharacterAutomationsProps {
  characterName: string;
  character: Character;
}

export function CharacterAutomations({
  characterName,
  character,
}: CharacterAutomationsProps) {
  const { data: automations, isLoading } = useAutomations();
  const { data: statuses } = useAutomationStatuses();
  const [selectedTemplate, setSelectedTemplate] =
    useState<GalleryTemplate | null>(null);

  const charAutomations = useMemo(
    () =>
      (automations ?? []).filter((a) => a.character_name === characterName),
    [automations, characterName]
  );

  const statusMap = useMemo(
    () => new Map((statuses ?? []).map((s) => [s.config_id, s])),
    [statuses]
  );

  const suggestions = useMemo(() => {
    const activeStrategyTypes = new Set(
      charAutomations.map((a) => a.strategy_type)
    );

    return GALLERY_TEMPLATES.filter((t) => {
      // Character meets min_level
      if (character.level < t.min_level) return false;

      // Character meets skill requirement
      if (t.skill_requirement) {
        const key =
          `${t.skill_requirement.skill}_level` as keyof Character;
        const level = character[key];
        if (typeof level !== "number" || level < t.skill_requirement.level)
          return false;
      }

      // Don't suggest if character already has an automation with the same strategy_type + key config
      const hasMatching = charAutomations.some((a) => {
        if (a.strategy_type !== t.strategy_type) return false;
        // Check key config fields match
        const configKeys = Object.keys(t.config);
        if (configKeys.length === 0) return true;
        return configKeys.every(
          (k) =>
            JSON.stringify(a.config[k]) === JSON.stringify(t.config[k])
        );
      });

      return !hasMatching;
    }).slice(0, MAX_SUGGESTIONS);
  }, [character, charAutomations]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="size-4 text-muted-foreground" />
              Automations
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/automations">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Active Automations */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && charAutomations.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No automations for this character.
            </p>
          )}

          {charAutomations.length > 0 && (
            <div className="space-y-2">
              {charAutomations.map((automation) => {
                const status = statusMap.get(automation.id);
                const currentStatus = status?.status ?? "stopped";
                const actionsCount = status?.actions_count ?? 0;
                const Icon =
                  STRATEGY_ICONS[automation.strategy_type] ?? Bot;
                const colors = STRATEGY_COLORS[automation.strategy_type];

                return (
                  <div
                    key={automation.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md",
                          colors?.bg ?? "bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            colors?.text ?? "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/automations/${automation.id}`}
                          className="text-sm font-medium hover:text-primary transition-colors truncate block"
                        >
                          {automation.name}
                          <ExternalLink className="size-3 inline ml-1 opacity-50" />
                        </Link>
                        <span
                          className={cn(
                            "text-xs capitalize",
                            colors?.text ?? "text-muted-foreground"
                          )}
                        >
                          {automation.strategy_type}
                        </span>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <RunControls
                        automationId={automation.id}
                        status={currentStatus}
                        actionsCount={actionsCount}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggested Automations */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Suggested
                </h3>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/automations">Browse all</Link>
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((template) => {
                  const Icon =
                    STRATEGY_ICONS[template.strategy_type] ?? Zap;
                  const colors =
                    STRATEGY_COLORS[template.strategy_type];

                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all",
                        "hover:border-primary/30 hover:bg-accent/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md mt-0.5",
                          colors?.bg ?? "bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-3.5",
                            colors?.text ?? "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block truncate">
                          {template.name}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {template.description}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize mt-1.5",
                            DIFFICULTY_COLORS[template.difficulty]
                          )}
                        >
                          {template.difficulty}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <GalleryActivateDialog
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
      />
    </>
  );
}

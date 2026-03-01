"use client";

import { useState } from "react";
import {
  Loader2,
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  ClipboardList,
  GraduationCap,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfigForm } from "@/components/automation/config-form";
import { useCharacters } from "@/hooks/use-characters";
import { useCreateAutomation, useControlAutomation } from "@/hooks/use-automations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { GalleryTemplate } from "./gallery-templates";
import type { Character } from "@/lib/types";

const STRATEGY_ICONS: Record<string, React.ReactNode> = {
  combat: <Swords className="size-4 text-red-400" />,
  gathering: <Pickaxe className="size-4 text-green-400" />,
  crafting: <Hammer className="size-4 text-blue-400" />,
  trading: <TrendingUp className="size-4 text-yellow-400" />,
  task: <ClipboardList className="size-4 text-purple-400" />,
  leveling: <GraduationCap className="size-4 text-cyan-400" />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/10 text-red-400 border-red-500/30",
};

interface GalleryActivateDialogProps {
  template: GalleryTemplate | null;
  onClose: () => void;
}

export function GalleryActivateDialog({
  template,
  onClose,
}: GalleryActivateDialogProps) {
  const { data: characters, isLoading: loadingCharacters } = useCharacters();
  const createMutation = useCreateAutomation();
  const controlMutation = useControlAutomation();

  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(
    new Set()
  );
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [autoStart, setAutoStart] = useState(true);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    results: { name: string; success: boolean; error?: string }[];
  } | null>(null);

  // Reset state when template changes
  function handleOpenChange(open: boolean) {
    if (!open) {
      setSelectedCharacters(new Set());
      setConfig({});
      setShowConfig(false);
      setAutoStart(true);
      setCreating(false);
      setProgress(null);
      onClose();
    }
  }

  // Initialize config from template when it opens
  if (template && Object.keys(config).length === 0) {
    setConfig({ ...template.config });
  }

  function toggleCharacter(name: string) {
    setSelectedCharacters((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function selectAll() {
    if (!characters) return;
    setSelectedCharacters(new Set(characters.map((c) => c.name)));
  }

  function deselectAll() {
    setSelectedCharacters(new Set());
  }

  function getSkillLevel(char: Character, skill: string): number {
    const key = `${skill}_level` as keyof Character;
    const val = char[key];
    return typeof val === "number" ? val : 0;
  }

  async function handleActivate() {
    if (!template || selectedCharacters.size === 0) return;

    setCreating(true);
    const names = Array.from(selectedCharacters);
    const results: { name: string; success: boolean; error?: string }[] = [];
    setProgress({ total: names.length, done: 0, results });

    for (const charName of names) {
      const automationName = `${template.name} (${charName})`;
      try {
        const created = await createMutation.mutateAsync({
          name: automationName,
          character_name: charName,
          strategy_type: template.strategy_type,
          config,
        });

        if (autoStart && created?.id) {
          try {
            await controlMutation.mutateAsync({
              id: created.id,
              action: "start",
            });
          } catch {
            // Created but failed to start - still a partial success
          }
        }

        results.push({ name: charName, success: true });
      } catch (err) {
        results.push({
          name: charName,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      setProgress({ total: names.length, done: results.length, results: [...results] });
    }

    setCreating(false);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (failCount === 0) {
      toast.success(
        `Created ${successCount} automation${successCount > 1 ? "s" : ""}${autoStart ? " and started" : ""}`
      );
      handleOpenChange(false);
    } else if (successCount > 0) {
      toast.warning(
        `Created ${successCount}, failed ${failCount} automation(s)`
      );
    } else {
      toast.error("Failed to create automations");
    }
  }

  const allSelected =
    characters && characters.length > 0 && selectedCharacters.size === characters.length;

  return (
    <Dialog open={template !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {template && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {STRATEGY_ICONS[template.strategy_type]}
                {template.name}
              </DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn("capitalize", DIFFICULTY_COLORS[template.difficulty])}
              >
                {template.difficulty}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {template.strategy_type}
              </Badge>
              {template.min_level > 1 && (
                <Badge variant="outline">Lv. {template.min_level}+</Badge>
              )}
              {template.skill_requirement && (
                <Badge variant="outline">
                  {template.skill_requirement.skill} Lv.{" "}
                  {template.skill_requirement.level}+
                </Badge>
              )}
            </div>

            <Separator />

            {/* Character Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Select Characters
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={allSelected ? deselectAll : selectAll}
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              </div>

              {loadingCharacters && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {characters && characters.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No characters found. Make sure the backend is connected.
                </p>
              )}

              {characters && characters.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {characters.map((char) => {
                    const isSelected = selectedCharacters.has(char.name);
                    const meetsLevel = char.level >= template.min_level;
                    const meetsSkill = template.skill_requirement
                      ? getSkillLevel(char, template.skill_requirement.skill) >=
                        template.skill_requirement.level
                      : true;
                    const meetsRequirements = meetsLevel && meetsSkill;

                    return (
                      <Card
                        key={char.name}
                        className={cn(
                          "cursor-pointer transition-all p-3",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:bg-accent/30",
                          !meetsRequirements && "opacity-60"
                        )}
                        onClick={() => toggleCharacter(char.name)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isSelected && <Check className="size-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {char.name}
                              </span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Lv. {char.level}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {template.skill_requirement && (
                                <span
                                  className={cn(
                                    meetsSkill
                                      ? "text-green-400"
                                      : "text-red-400"
                                  )}
                                >
                                  {template.skill_requirement.skill}:{" "}
                                  {getSkillLevel(
                                    char,
                                    template.skill_requirement.skill
                                  )}
                                </span>
                              )}
                              {!template.skill_requirement && (
                                <span>HP: {char.hp}/{char.max_hp}</span>
                              )}
                            </div>
                          </div>
                          {!meetsRequirements && (
                            <Badge
                              variant="outline"
                              className="text-xs text-yellow-400 border-yellow-500/30 shrink-0"
                            >
                              Low level
                            </Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Config Customization (Collapsible) */}
            <div className="space-y-3">
              <button
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full"
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                Customize Configuration
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </button>

              {showConfig && (
                <div className="rounded-lg border p-4">
                  <ConfigForm
                    strategyType={template.strategy_type}
                    config={config}
                    onChange={setConfig}
                  />
                </div>
              )}
            </div>

            {/* Progress */}
            {progress && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {progress.done} / {progress.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${(progress.done / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                  {progress.results.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {progress.results.map((r) => (
                        <div
                          key={r.name}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              r.success ? "bg-green-400" : "bg-red-400"
                            )}
                          />
                          <span className="text-muted-foreground">
                            {r.name}
                          </span>
                          {r.error && (
                            <span className="text-red-400 truncate">
                              {r.error}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="flex-row items-center gap-3 sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="rounded border-muted-foreground/30"
                  disabled={creating}
                />
                Auto-start after creating
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleActivate}
                  disabled={
                    selectedCharacters.size === 0 || creating
                  }
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  {creating
                    ? "Creating..."
                    : `Activate for ${selectedCharacters.size} character${selectedCharacters.size !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCharacters } from "@/hooks/use-characters";
import { useCreatePipeline } from "@/hooks/use-pipelines";
import { PIPELINE_TEMPLATES } from "./pipeline-templates";
import { toast } from "sonner";

interface CharacterStepDraft {
  id: string;
  character_name: string;
  strategy_type: string;
  config: Record<string, unknown>;
  transition: {
    type: string;
    operator?: string;
    value?: number;
    item_code?: string;
    skill?: string;
    seconds?: number;
  } | null;
}

interface StageDraft {
  id: string;
  name: string;
  character_steps: CharacterStepDraft[];
}

const STRATEGY_OPTIONS = [
  { value: "combat", label: "Combat" },
  { value: "gathering", label: "Gathering" },
  { value: "crafting", label: "Crafting" },
  { value: "trading", label: "Trading" },
  { value: "task", label: "Task" },
  { value: "leveling", label: "Leveling" },
];

const TRANSITION_OPTIONS = [
  { value: "strategy_complete", label: "Strategy Complete" },
  { value: "inventory_full", label: "Inventory Full" },
  { value: "inventory_item_count", label: "Inventory Item Count" },
  { value: "bank_item_count", label: "Bank Item Count" },
  { value: "skill_level", label: "Skill Level" },
  { value: "gold_amount", label: "Gold Amount" },
  { value: "actions_count", label: "Actions Count" },
  { value: "timer", label: "Timer (seconds)" },
];

function makeStageId(idx: number) {
  return `stage_${idx + 1}`;
}

function makeStepId(stageIdx: number, stepIdx: number) {
  return `cs_${stageIdx + 1}${String.fromCharCode(97 + stepIdx)}`;
}

export function PipelineBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const { data: characters } = useCharacters();
  const createMutation = useCreatePipeline();

  // Initialize from template if provided
  const template = templateId
    ? PIPELINE_TEMPLATES.find((t) => t.id === templateId)
    : null;

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [loop, setLoop] = useState(template?.loop ?? false);
  const [maxLoops, setMaxLoops] = useState(template?.max_loops ?? 0);
  const [stages, setStages] = useState<StageDraft[]>(() => {
    if (template) {
      return template.stages.map((s, i) => ({
        id: makeStageId(i),
        name: s.name,
        character_steps: s.character_steps.map((cs, j) => ({
          id: makeStepId(i, j),
          character_name: cs.role ?? "",
          strategy_type: cs.strategy_type,
          config: cs.config,
          transition: cs.transition,
        })),
      }));
    }
    return [
      {
        id: "stage_1",
        name: "Stage 1",
        character_steps: [
          {
            id: "cs_1a",
            character_name: "",
            strategy_type: "gathering",
            config: {},
            transition: { type: "strategy_complete" },
          },
        ],
      },
    ];
  });

  function addStage() {
    const idx = stages.length;
    setStages([
      ...stages,
      {
        id: makeStageId(idx),
        name: `Stage ${idx + 1}`,
        character_steps: [
          {
            id: makeStepId(idx, 0),
            character_name: "",
            strategy_type: "gathering",
            config: {},
            transition: { type: "strategy_complete" },
          },
        ],
      },
    ]);
  }

  function removeStage(idx: number) {
    setStages(stages.filter((_, i) => i !== idx));
  }

  function moveStage(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const copy = [...stages];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setStages(copy);
  }

  function updateStage(idx: number, patch: Partial<StageDraft>) {
    setStages(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addCharacterStep(stageIdx: number) {
    const stage = stages[stageIdx];
    const stepIdx = stage.character_steps.length;
    updateStage(stageIdx, {
      character_steps: [
        ...stage.character_steps,
        {
          id: makeStepId(stageIdx, stepIdx),
          character_name: "",
          strategy_type: "gathering",
          config: {},
          transition: { type: "strategy_complete" },
        },
      ],
    });
  }

  function removeCharacterStep(stageIdx: number, stepIdx: number) {
    const stage = stages[stageIdx];
    updateStage(stageIdx, {
      character_steps: stage.character_steps.filter((_, i) => i !== stepIdx),
    });
  }

  function updateCharacterStep(
    stageIdx: number,
    stepIdx: number,
    patch: Partial<CharacterStepDraft>
  ) {
    const stage = stages[stageIdx];
    updateStage(stageIdx, {
      character_steps: stage.character_steps.map((cs, i) =>
        i === stepIdx ? { ...cs, ...patch } : cs
      ),
    });
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Pipeline name is required");
      return;
    }
    const hasEmptyChar = stages.some((s) =>
      s.character_steps.some((cs) => !cs.character_name)
    );
    if (hasEmptyChar) {
      toast.error("All character steps must have a character assigned");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        stages: stages.map((s) => ({
          id: s.id,
          name: s.name,
          character_steps: s.character_steps.map((cs) => ({
            id: cs.id,
            character_name: cs.character_name,
            strategy_type: cs.strategy_type,
            config: cs.config,
            transition: cs.transition,
          })),
        })),
        loop,
        max_loops: maxLoops,
      },
      {
        onSuccess: () => {
          toast.success("Pipeline created");
          router.push("/automations");
        },
        onError: (err) => {
          toast.error(`Failed to create pipeline: ${err.message}`);
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Pipeline Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Pipeline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this pipeline do?"
                rows={1}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="loop"
                checked={loop}
                onCheckedChange={setLoop}
              />
              <Label htmlFor="loop">Loop pipeline</Label>
            </div>
            {loop && (
              <div className="flex items-center gap-2">
                <Label htmlFor="maxLoops">Max loops (0 = unlimited)</Label>
                <Input
                  id="maxLoops"
                  type="number"
                  min={0}
                  className="w-24"
                  value={maxLoops}
                  onChange={(e) => setMaxLoops(Number(e.target.value))}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stages */}
      <div className="space-y-4">
        {stages.map((stage, stageIdx) => (
          <Card key={stage.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    Stage {stageIdx + 1}
                  </Badge>
                  <Input
                    value={stage.name}
                    onChange={(e) =>
                      updateStage(stageIdx, { name: e.target.value })
                    }
                    className="h-8 w-48"
                    placeholder="Stage name"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => moveStage(stageIdx, -1)}
                    disabled={stageIdx === 0}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => moveStage(stageIdx, 1)}
                    disabled={stageIdx === stages.length - 1}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeStage(stageIdx)}
                    disabled={stages.length <= 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Character steps run in parallel within this stage
              </p>
              {stage.character_steps.map((cs, stepIdx) => (
                <div
                  key={cs.id}
                  className="border rounded-lg p-3 space-y-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Worker {stepIdx + 1}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeCharacterStep(stageIdx, stepIdx)}
                      disabled={stage.character_steps.length <= 1}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Character</Label>
                      <Select
                        value={cs.character_name}
                        onValueChange={(v) =>
                          updateCharacterStep(stageIdx, stepIdx, {
                            character_name: v,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select character" />
                        </SelectTrigger>
                        <SelectContent>
                          {(characters ?? []).map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Strategy</Label>
                      <Select
                        value={cs.strategy_type}
                        onValueChange={(v) =>
                          updateCharacterStep(stageIdx, stepIdx, {
                            strategy_type: v,
                            config: {},
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STRATEGY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Transition</Label>
                      <Select
                        value={cs.transition?.type ?? "strategy_complete"}
                        onValueChange={(v) =>
                          updateCharacterStep(stageIdx, stepIdx, {
                            transition: { type: v },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSITION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Config fields based on strategy */}
                  <StrategyConfigFields
                    strategyType={cs.strategy_type}
                    config={cs.config}
                    onChange={(config) =>
                      updateCharacterStep(stageIdx, stepIdx, { config })
                    }
                  />
                  {/* Transition value fields */}
                  <TransitionValueFields
                    transition={cs.transition}
                    onChange={(transition) =>
                      updateCharacterStep(stageIdx, stepIdx, { transition })
                    }
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => addCharacterStep(stageIdx)}
              >
                <Plus className="size-3" />
                Add Character Worker
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addStage}>
        <Plus className="size-4" />
        Add Stage
      </Button>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Create Pipeline
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/automations")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function StrategyConfigFields({
  strategyType,
  config,
  onChange,
}: {
  strategyType: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  switch (strategyType) {
    case "gathering":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Resource Code</Label>
            <Input
              className="h-8 text-xs"
              value={(config.resource_code as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, resource_code: e.target.value })
              }
              placeholder="copper_rocks"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Switch
              checked={(config.deposit_on_full as boolean) ?? true}
              onCheckedChange={(v) =>
                onChange({ ...config, deposit_on_full: v })
              }
            />
            <Label className="text-xs">Deposit on full</Label>
          </div>
        </div>
      );
    case "combat":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Monster Code</Label>
            <Input
              className="h-8 text-xs"
              value={(config.monster_code as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, monster_code: e.target.value })
              }
              placeholder="chicken"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Switch
              checked={(config.deposit_loot as boolean) ?? true}
              onCheckedChange={(v) =>
                onChange({ ...config, deposit_loot: v })
              }
            />
            <Label className="text-xs">Deposit loot</Label>
          </div>
        </div>
      );
    case "crafting":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Item Code</Label>
            <Input
              className="h-8 text-xs"
              value={(config.item_code as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, item_code: e.target.value })
              }
              placeholder="copper_dagger"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantity</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              min={1}
              value={(config.quantity as number) ?? 10}
              onChange={(e) =>
                onChange({ ...config, quantity: Number(e.target.value) })
              }
            />
          </div>
        </div>
      );
    case "trading":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select
              value={(config.mode as string) ?? "sell_loot"}
              onValueChange={(v) => onChange({ ...config, mode: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sell_loot">Sell Loot</SelectItem>
                <SelectItem value="buy_materials">Buy Materials</SelectItem>
                <SelectItem value="flip">Flip</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Item Code</Label>
            <Input
              className="h-8 text-xs"
              value={(config.item_code as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, item_code: e.target.value })
              }
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

function TransitionValueFields({
  transition,
  onChange,
}: {
  transition: CharacterStepDraft["transition"];
  onChange: (t: CharacterStepDraft["transition"]) => void;
}) {
  if (!transition) return null;
  const type = transition.type;

  if (
    type === "strategy_complete" ||
    type === "inventory_full" ||
    type === "loops_completed"
  )
    return null;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(type === "inventory_item_count" || type === "bank_item_count") && (
        <div className="space-y-1">
          <Label className="text-xs">Item Code</Label>
          <Input
            className="h-8 text-xs"
            value={transition.item_code ?? ""}
            onChange={(e) =>
              onChange({ ...transition, item_code: e.target.value })
            }
            placeholder="copper_ore"
          />
        </div>
      )}
      {type === "skill_level" && (
        <div className="space-y-1">
          <Label className="text-xs">Skill</Label>
          <Input
            className="h-8 text-xs"
            value={transition.skill ?? ""}
            onChange={(e) =>
              onChange({ ...transition, skill: e.target.value })
            }
            placeholder="mining"
          />
        </div>
      )}
      {type === "timer" ? (
        <div className="space-y-1">
          <Label className="text-xs">Seconds</Label>
          <Input
            className="h-8 text-xs"
            type="number"
            min={1}
            value={transition.seconds ?? 60}
            onChange={(e) =>
              onChange({ ...transition, seconds: Number(e.target.value) })
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Operator</Label>
            <Select
              value={transition.operator ?? ">="}
              onValueChange={(v) => onChange({ ...transition, operator: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=">=">&gt;=</SelectItem>
                <SelectItem value="<=">&lt;=</SelectItem>
                <SelectItem value="==">=</SelectItem>
                <SelectItem value=">">&gt;</SelectItem>
                <SelectItem value="<">&lt;</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              min={0}
              value={transition.value ?? 0}
              onChange={(e) =>
                onChange({ ...transition, value: Number(e.target.value) })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

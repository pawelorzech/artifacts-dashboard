"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransitionCondition } from "@/lib/types";

const TRANSITION_TYPES = [
  { value: "strategy_complete", label: "Strategy Completes" },
  { value: "actions_count", label: "Actions Count" },
  { value: "timer", label: "Timer (seconds)" },
  { value: "inventory_full", label: "Inventory Full" },
  { value: "inventory_item_count", label: "Inventory Item Count" },
  { value: "bank_item_count", label: "Bank Item Count" },
  { value: "skill_level", label: "Skill Level" },
  { value: "gold_amount", label: "Gold Amount" },
] as const;

const OPERATORS = [
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "==", label: "==" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
] as const;

const SKILLS = [
  "mining",
  "woodcutting",
  "fishing",
  "weaponcrafting",
  "gearcrafting",
  "jewelrycrafting",
  "cooking",
  "alchemy",
] as const;

interface TransitionEditorProps {
  value: TransitionCondition | null;
  onChange: (condition: TransitionCondition | null) => void;
}

export function TransitionEditor({ value, onChange }: TransitionEditorProps) {
  const condType = value?.type ?? "";
  const needsValue =
    condType === "actions_count" ||
    condType === "inventory_item_count" ||
    condType === "bank_item_count" ||
    condType === "skill_level" ||
    condType === "gold_amount";
  const needsItemCode =
    condType === "inventory_item_count" || condType === "bank_item_count";
  const needsSkill = condType === "skill_level";
  const needsSeconds = condType === "timer";

  function update(partial: Partial<TransitionCondition>) {
    const base: TransitionCondition = value ?? {
      type: "strategy_complete",
      operator: ">=",
      value: 0,
      item_code: "",
      skill: "",
      seconds: 0,
    };
    onChange({ ...base, ...partial });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">
          Transition Condition
        </Label>
        <Select
          value={condType || "none"}
          onValueChange={(v) => {
            if (v === "none") {
              onChange(null);
            } else {
              update({
                type: v as TransitionCondition["type"],
              });
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="No transition (run until complete)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              No transition (run until strategy completes)
            </SelectItem>
            {TRANSITION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsValue && (
        <div className="flex gap-2">
          <div className="w-20">
            <Label className="text-xs text-muted-foreground">Operator</Label>
            <Select
              value={value?.operator ?? ">="}
              onValueChange={(v) =>
                update({ operator: v as TransitionCondition["operator"] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              value={value?.value ?? 0}
              onChange={(e) => update({ value: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {needsItemCode && (
        <div>
          <Label className="text-xs text-muted-foreground">Item Code</Label>
          <Input
            className="h-8 text-xs"
            placeholder="e.g. copper_ore"
            value={value?.item_code ?? ""}
            onChange={(e) => update({ item_code: e.target.value })}
          />
        </div>
      )}

      {needsSkill && (
        <div>
          <Label className="text-xs text-muted-foreground">Skill</Label>
          <Select
            value={value?.skill ?? "mining"}
            onValueChange={(v) => update({ skill: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILLS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {needsSeconds && (
        <div>
          <Label className="text-xs text-muted-foreground">Seconds</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={value?.seconds ?? 0}
            onChange={(e) => update({ seconds: Number(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
}

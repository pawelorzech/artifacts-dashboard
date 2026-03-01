"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SKILLS } from "@/lib/constants";
import type {
  CombatConfig,
  GatheringConfig,
  CraftingConfig,
  TradingConfig,
  TaskConfig,
  LevelingConfig,
} from "@/lib/types";

// ---------- Combat ----------

interface CombatConfigFormProps {
  value: CombatConfig;
  onChange: (config: CombatConfig) => void;
}

export function CombatConfigForm({ value, onChange }: CombatConfigFormProps) {
  function update(partial: Partial<CombatConfig>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="monster_code">Monster Code</Label>
        <Input
          id="monster_code"
          placeholder="e.g. chicken, green_slime, wolf"
          value={value.monster_code}
          onChange={(e) => update({ monster_code: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The code of the monster to fight. Check the game data for valid codes.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Auto Heal Threshold</Label>
          <span className="text-sm text-muted-foreground">
            {value.auto_heal_threshold}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[value.auto_heal_threshold]}
          onValueChange={([v]) => update({ auto_heal_threshold: v })}
        />
        <p className="text-xs text-muted-foreground">
          Heal when HP drops below this percentage.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Heal Method</Label>
        <Select
          value={value.heal_method}
          onValueChange={(v) =>
            update({ heal_method: v as "rest" | "consumable" })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rest">Rest (free, slower)</SelectItem>
            <SelectItem value="consumable">
              Consumable (uses items, faster)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.heal_method === "consumable" && (
        <div className="space-y-2">
          <Label htmlFor="consumable_code">Consumable Code</Label>
          <Input
            id="consumable_code"
            placeholder="e.g. cooked_chicken"
            value={value.consumable_code ?? ""}
            onChange={(e) => update({ consumable_code: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            The item code of the healing consumable to use.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Min Inventory Slots Free</Label>
          <span className="text-sm text-muted-foreground">
            {value.min_inventory_slots}
          </span>
        </div>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[value.min_inventory_slots]}
          onValueChange={([v]) => update({ min_inventory_slots: v })}
        />
        <p className="text-xs text-muted-foreground">
          Go to bank when fewer than this many slots are free.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Deposit Loot</Label>
          <p className="text-xs text-muted-foreground">
            Automatically deposit loot at the bank when inventory is full.
          </p>
        </div>
        <Switch
          checked={value.deposit_loot}
          onCheckedChange={(checked) => update({ deposit_loot: checked })}
        />
      </div>
    </div>
  );
}

// ---------- Gathering ----------

interface GatheringConfigFormProps {
  value: GatheringConfig;
  onChange: (config: GatheringConfig) => void;
}

export function GatheringConfigForm({
  value,
  onChange,
}: GatheringConfigFormProps) {
  function update(partial: Partial<GatheringConfig>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="resource_code">Resource Code</Label>
        <Input
          id="resource_code"
          placeholder="e.g. copper_ore, ash_tree, gudgeon"
          value={value.resource_code}
          onChange={(e) => update({ resource_code: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The code of the resource to gather. Check the game data for valid
          codes.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Deposit on Full</Label>
          <p className="text-xs text-muted-foreground">
            Automatically deposit gathered items at the bank when inventory is
            full.
          </p>
        </div>
        <Switch
          checked={value.deposit_on_full}
          onCheckedChange={(checked) => update({ deposit_on_full: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_loops">Max Loops</Label>
        <Input
          id="max_loops"
          type="number"
          min={0}
          placeholder="0 = infinite"
          value={value.max_loops}
          onChange={(e) =>
            update({ max_loops: parseInt(e.target.value, 10) || 0 })
          }
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of gathering loops. Set to 0 for infinite.
        </p>
      </div>
    </div>
  );
}

// ---------- Crafting ----------

interface CraftingConfigFormProps {
  value: CraftingConfig;
  onChange: (config: CraftingConfig) => void;
}

export function CraftingConfigForm({
  value,
  onChange,
}: CraftingConfigFormProps) {
  function update(partial: Partial<CraftingConfig>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="craft_item_code">Item Code</Label>
        <Input
          id="craft_item_code"
          placeholder="e.g. copper_sword, iron_helmet"
          value={value.item_code}
          onChange={(e) => update({ item_code: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The code of the item to craft. Check the game data for valid codes.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="craft_quantity">Quantity</Label>
        <Input
          id="craft_quantity"
          type="number"
          min={1}
          placeholder="1"
          value={value.quantity}
          onChange={(e) =>
            update({ quantity: parseInt(e.target.value, 10) || 1 })
          }
        />
        <p className="text-xs text-muted-foreground">
          Number of items to craft. Set to 0 for infinite.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Gather Materials</Label>
          <p className="text-xs text-muted-foreground">
            Automatically gather required materials before crafting.
          </p>
        </div>
        <Switch
          checked={value.gather_materials}
          onCheckedChange={(checked) =>
            update({ gather_materials: checked })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Recycle Excess</Label>
          <p className="text-xs text-muted-foreground">
            Recycle excess crafted items to recover some materials.
          </p>
        </div>
        <Switch
          checked={value.recycle_excess}
          onCheckedChange={(checked) => update({ recycle_excess: checked })}
        />
      </div>
    </div>
  );
}

// ---------- Trading ----------

interface TradingConfigFormProps {
  value: TradingConfig;
  onChange: (config: TradingConfig) => void;
}

export function TradingConfigForm({
  value,
  onChange,
}: TradingConfigFormProps) {
  function update(partial: Partial<TradingConfig>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Trading Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            update({ mode: v as "sell_loot" | "buy_materials" | "flip" })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sell_loot">Sell Loot</SelectItem>
            <SelectItem value="buy_materials">Buy Materials</SelectItem>
            <SelectItem value="flip">Flip (Buy Low / Sell High)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose how the trading automation should operate.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trade_item_code">Item Code</Label>
        <Input
          id="trade_item_code"
          placeholder="e.g. copper_ore, cooked_chicken"
          value={value.item_code}
          onChange={(e) => update({ item_code: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The item to trade. Leave empty to trade all applicable items.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min_price">Min Price</Label>
          <Input
            id="min_price"
            type="number"
            min={0}
            placeholder="0"
            value={value.min_price}
            onChange={(e) =>
              update({ min_price: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_price">Max Price</Label>
          <Input
            id="max_price"
            type="number"
            min={0}
            placeholder="0"
            value={value.max_price}
            onChange={(e) =>
              update({ max_price: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Price boundaries for buying/selling. Set to 0 to use market prices.
      </p>

      <div className="space-y-2">
        <Label htmlFor="trade_quantity">Quantity</Label>
        <Input
          id="trade_quantity"
          type="number"
          min={0}
          placeholder="0 = all available"
          value={value.quantity}
          onChange={(e) =>
            update({ quantity: parseInt(e.target.value, 10) || 0 })
          }
        />
        <p className="text-xs text-muted-foreground">
          Maximum quantity to trade. Set to 0 for unlimited.
        </p>
      </div>
    </div>
  );
}

// ---------- Task ----------

interface TaskConfigFormProps {
  value: TaskConfig;
  onChange: (config: TaskConfig) => void;
}

export function TaskConfigForm({ value: _value, onChange: _onChange }: TaskConfigFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
        <p className="text-sm text-muted-foreground">
          Task automation will auto-accept and complete tasks from the tasks
          master. No additional configuration is needed. The automation will
          handle moving to the tasks master, accepting tasks, completing them,
          and turning them in.
        </p>
      </div>
    </div>
  );
}

// ---------- Leveling ----------

interface LevelingConfigFormProps {
  value: LevelingConfig;
  onChange: (config: LevelingConfig) => void;
}

export function LevelingConfigForm({
  value,
  onChange,
}: LevelingConfigFormProps) {
  function update(partial: Partial<LevelingConfig>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Target Skill (Optional)</Label>
        <Select
          value={value.target_skill ?? "_any"}
          onValueChange={(v) =>
            update({ target_skill: v === "_any" ? undefined : v })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Any skill (auto-detect)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_any">Any skill (auto-detect)</SelectItem>
            {SKILLS.map((skill) => (
              <SelectItem key={skill.key} value={skill.key}>
                {skill.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Optionally focus on a specific skill. If left to auto-detect, the
          automation will choose the most efficient skill to level.
        </p>
      </div>
    </div>
  );
}

// ---------- Unified Config Form ----------

type StrategyType =
  | "combat"
  | "gathering"
  | "crafting"
  | "trading"
  | "task"
  | "leveling";

interface ConfigFormProps {
  strategyType: StrategyType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  monster_code: "",
  auto_heal_threshold: 50,
  heal_method: "rest",
  min_inventory_slots: 3,
  deposit_loot: true,
};

const DEFAULT_GATHERING_CONFIG: GatheringConfig = {
  resource_code: "",
  deposit_on_full: true,
  max_loops: 0,
};

const DEFAULT_CRAFTING_CONFIG: CraftingConfig = {
  item_code: "",
  quantity: 1,
  gather_materials: true,
  recycle_excess: false,
};

const DEFAULT_TRADING_CONFIG: TradingConfig = {
  mode: "sell_loot",
  item_code: "",
  min_price: 0,
  max_price: 0,
  quantity: 0,
};

const DEFAULT_TASK_CONFIG: TaskConfig = {};

const DEFAULT_LEVELING_CONFIG: LevelingConfig = {};

export function ConfigForm({ strategyType, config, onChange }: ConfigFormProps) {
  const cast = (c: unknown) => onChange(c as Record<string, unknown>);

  switch (strategyType) {
    case "combat": {
      const merged: CombatConfig = {
        ...DEFAULT_COMBAT_CONFIG,
        ...(config as Partial<CombatConfig>),
      };
      return <CombatConfigForm value={merged} onChange={(c) => cast(c)} />;
    }
    case "gathering": {
      const merged: GatheringConfig = {
        ...DEFAULT_GATHERING_CONFIG,
        ...(config as Partial<GatheringConfig>),
      };
      return <GatheringConfigForm value={merged} onChange={(c) => cast(c)} />;
    }
    case "crafting": {
      const merged: CraftingConfig = {
        ...DEFAULT_CRAFTING_CONFIG,
        ...(config as Partial<CraftingConfig>),
      };
      return <CraftingConfigForm value={merged} onChange={(c) => cast(c)} />;
    }
    case "trading": {
      const merged: TradingConfig = {
        ...DEFAULT_TRADING_CONFIG,
        ...(config as Partial<TradingConfig>),
      };
      return <TradingConfigForm value={merged} onChange={(c) => cast(c)} />;
    }
    case "task": {
      const merged: TaskConfig = {
        ...DEFAULT_TASK_CONFIG,
        ...(config as Partial<TaskConfig>),
      };
      return <TaskConfigForm value={merged} onChange={(c) => cast(c)} />;
    }
    case "leveling": {
      const merged: LevelingConfig = {
        ...DEFAULT_LEVELING_CONFIG,
        ...(config as Partial<LevelingConfig>),
      };
      return <LevelingConfigForm value={merged} onChange={(c) => cast(c)} />;
    }
    default:
      return null;
  }
}

export {
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_GATHERING_CONFIG,
  DEFAULT_CRAFTING_CONFIG,
  DEFAULT_TRADING_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_LEVELING_CONFIG,
};

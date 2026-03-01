export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: "production" | "combat" | "economy" | "leveling";
  roles: string[];
  stages: {
    id: string;
    name: string;
    character_steps: {
      id: string;
      role: string;
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
    }[];
  }[];
  loop: boolean;
  max_loops: number;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "resource_pipeline",
    name: "Resource Pipeline",
    description:
      "Gatherer collects resources and banks them, Crafter withdraws and crafts, Seller lists on GE. 3 characters, 3 stages.",
    category: "production",
    roles: ["Gatherer", "Crafter", "Seller"],
    stages: [
      {
        id: "stage_1",
        name: "Gather Resources",
        character_steps: [
          {
            id: "cs_1a",
            role: "Gatherer",
            strategy_type: "gathering",
            config: { resource_code: "copper_rocks", deposit_on_full: true },
            transition: {
              type: "bank_item_count",
              item_code: "copper_ore",
              operator: ">=",
              value: 100,
            },
          },
        ],
      },
      {
        id: "stage_2",
        name: "Craft Items",
        character_steps: [
          {
            id: "cs_2a",
            role: "Crafter",
            strategy_type: "crafting",
            config: {
              item_code: "copper_dagger",
              quantity: 50,
              gather_materials: false,
            },
            transition: { type: "strategy_complete" },
          },
        ],
      },
      {
        id: "stage_3",
        name: "Sell on GE",
        character_steps: [
          {
            id: "cs_3a",
            role: "Seller",
            strategy_type: "trading",
            config: {
              mode: "sell_loot",
              item_code: "copper_dagger",
              quantity: 50,
              min_price: 1,
            },
            transition: { type: "strategy_complete" },
          },
        ],
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "dual_gatherer_pipeline",
    name: "Dual Gatherer Pipeline",
    description:
      "Two miners gather copper in parallel, then one crafter turns it all into daggers. Double the gathering speed.",
    category: "production",
    roles: ["Miner1", "Miner2", "Crafter"],
    stages: [
      {
        id: "stage_1",
        name: "Parallel Gathering",
        character_steps: [
          {
            id: "cs_1a",
            role: "Miner1",
            strategy_type: "gathering",
            config: { resource_code: "copper_rocks", deposit_on_full: true },
            transition: {
              type: "bank_item_count",
              item_code: "copper_ore",
              operator: ">=",
              value: 200,
            },
          },
          {
            id: "cs_1b",
            role: "Miner2",
            strategy_type: "gathering",
            config: { resource_code: "copper_rocks", deposit_on_full: true },
            transition: {
              type: "bank_item_count",
              item_code: "copper_ore",
              operator: ">=",
              value: 200,
            },
          },
        ],
      },
      {
        id: "stage_2",
        name: "Craft Items",
        character_steps: [
          {
            id: "cs_2a",
            role: "Crafter",
            strategy_type: "crafting",
            config: {
              item_code: "copper_dagger",
              quantity: 100,
              gather_materials: false,
            },
            transition: { type: "strategy_complete" },
          },
        ],
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "combat_supply_chain",
    name: "Combat Supply Chain",
    description:
      "Fisher catches and cooks food, then Fighter uses it for sustained combat with consumable healing.",
    category: "combat",
    roles: ["Chef", "Fighter"],
    stages: [
      {
        id: "stage_1",
        name: "Prepare Food",
        character_steps: [
          {
            id: "cs_1a",
            role: "Chef",
            strategy_type: "gathering",
            config: { resource_code: "gudgeon_fishing_spot", deposit_on_full: true },
            transition: { type: "actions_count", operator: ">=", value: 40 },
          },
        ],
      },
      {
        id: "stage_2",
        name: "Cook Food",
        character_steps: [
          {
            id: "cs_1a",
            role: "Chef",
            strategy_type: "crafting",
            config: {
              item_code: "cooked_gudgeon",
              quantity: 30,
              gather_materials: false,
            },
            transition: { type: "strategy_complete" },
          },
        ],
      },
      {
        id: "stage_3",
        name: "Fight with Food",
        character_steps: [
          {
            id: "cs_3a",
            role: "Fighter",
            strategy_type: "combat",
            config: {
              monster_code: "yellow_slime",
              deposit_loot: true,
              auto_heal_threshold: 50,
              heal_method: "consumable",
              consumable_code: "cooked_gudgeon",
            },
            transition: { type: "actions_count", operator: ">=", value: 80 },
          },
        ],
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "full_economy",
    name: "Full Economy",
    description:
      "2 Gatherers mine in parallel, Crafter crafts items, Seller sells on GE. Complete 4-character production line.",
    category: "economy",
    roles: ["Miner1", "Miner2", "Crafter", "Seller"],
    stages: [
      {
        id: "stage_1",
        name: "Gather Resources",
        character_steps: [
          {
            id: "cs_1a",
            role: "Miner1",
            strategy_type: "gathering",
            config: { resource_code: "copper_rocks", deposit_on_full: true },
            transition: {
              type: "bank_item_count",
              item_code: "copper_ore",
              operator: ">=",
              value: 200,
            },
          },
          {
            id: "cs_1b",
            role: "Miner2",
            strategy_type: "gathering",
            config: { resource_code: "copper_rocks", deposit_on_full: true },
            transition: {
              type: "bank_item_count",
              item_code: "copper_ore",
              operator: ">=",
              value: 200,
            },
          },
        ],
      },
      {
        id: "stage_2",
        name: "Craft Items",
        character_steps: [
          {
            id: "cs_2a",
            role: "Crafter",
            strategy_type: "crafting",
            config: {
              item_code: "copper_dagger",
              quantity: 100,
              gather_materials: false,
            },
            transition: { type: "strategy_complete" },
          },
        ],
      },
      {
        id: "stage_3",
        name: "Sell on GE",
        character_steps: [
          {
            id: "cs_3a",
            role: "Seller",
            strategy_type: "trading",
            config: {
              mode: "sell_loot",
              item_code: "copper_dagger",
              quantity: 100,
              min_price: 1,
            },
            transition: { type: "strategy_complete" },
          },
        ],
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "power_leveling_duo",
    name: "Power Leveling Duo",
    description:
      "Two characters fight different monsters in parallel for maximum XP gain. Both deposit loot at end.",
    category: "leveling",
    roles: ["Fighter1", "Fighter2"],
    stages: [
      {
        id: "stage_1",
        name: "Parallel Combat",
        character_steps: [
          {
            id: "cs_1a",
            role: "Fighter1",
            strategy_type: "combat",
            config: {
              monster_code: "chicken",
              deposit_loot: true,
              auto_heal_threshold: 40,
            },
            transition: { type: "actions_count", operator: ">=", value: 100 },
          },
          {
            id: "cs_1b",
            role: "Fighter2",
            strategy_type: "combat",
            config: {
              monster_code: "yellow_slime",
              deposit_loot: true,
              auto_heal_threshold: 50,
            },
            transition: { type: "actions_count", operator: ">=", value: 100 },
          },
        ],
      },
    ],
    loop: true,
    max_loops: 0,
  },
];

export const PIPELINE_CATEGORY_LABELS: Record<string, string> = {
  production: "Production",
  combat: "Combat",
  economy: "Economy",
  leveling: "Leveling",
};

export const PIPELINE_CATEGORY_COLORS: Record<string, string> = {
  production: "text-blue-400",
  combat: "text-red-400",
  economy: "text-yellow-400",
  leveling: "text-cyan-400",
};

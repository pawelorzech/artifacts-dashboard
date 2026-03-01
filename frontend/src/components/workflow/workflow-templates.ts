export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "production" | "leveling" | "trading" | "utility";
  steps: {
    id: string;
    name: string;
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
  loop: boolean;
  max_loops: number;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "copper_pipeline",
    name: "Copper Pipeline",
    description:
      "Gather copper ore, craft copper daggers, sell on Grand Exchange. Repeats forever.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Gather Copper Ore",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Craft Copper Daggers",
        strategy_type: "crafting",
        config: {
          item_code: "copper_dagger",
          quantity: 10,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "copper_dagger",
          quantity: 10,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "iron_pipeline",
    name: "Iron Pipeline",
    description:
      "Gather iron ore, craft iron swords, sell on GE. Requires mining 10+.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Gather Iron Ore",
        strategy_type: "gathering",
        config: { resource_code: "iron_rocks", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Craft Iron Swords",
        strategy_type: "crafting",
        config: {
          item_code: "iron_sword",
          quantity: 10,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "iron_sword",
          quantity: 10,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "mining_progression",
    name: "Mining Progression",
    description:
      "Mine copper until level 10, then switch to iron until level 20.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Mine Copper (lv 1-10)",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "mining",
          operator: ">=",
          value: 10,
        },
      },
      {
        id: "step_2",
        name: "Mine Iron (lv 10-20)",
        strategy_type: "gathering",
        config: { resource_code: "iron_rocks", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "mining",
          operator: ">=",
          value: 20,
        },
      },
    ],
    loop: false,
    max_loops: 0,
  },
  {
    id: "combat_leveler",
    name: "Combat Leveler",
    description:
      "Fight chickens until level 5, then wolves until level 10, then stronger foes.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Fight Chickens (lv 1-5)",
        strategy_type: "combat",
        config: {
          monster_code: "chicken",
          deposit_loot: true,
          auto_heal_threshold: 40,
        },
        transition: { type: "actions_count", operator: ">=", value: 100 },
      },
      {
        id: "step_2",
        name: "Fight Yellow Slimes (lv 5-10)",
        strategy_type: "combat",
        config: {
          monster_code: "yellow_slime",
          deposit_loot: true,
          auto_heal_threshold: 50,
        },
        transition: { type: "actions_count", operator: ">=", value: 200 },
      },
      {
        id: "step_3",
        name: "Fight Wolves",
        strategy_type: "combat",
        config: {
          monster_code: "wolf",
          deposit_loot: true,
          auto_heal_threshold: 50,
        },
        transition: null,
      },
    ],
    loop: false,
    max_loops: 0,
  },
  {
    id: "task_grinder",
    name: "Task Grinder",
    description:
      "Accept task, complete it, exchange coins for rewards. Repeat.",
    category: "utility",
    steps: [
      {
        id: "step_1",
        name: "Complete Tasks",
        strategy_type: "task",
        config: { max_tasks: 5, auto_exchange: true },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "gather_and_sell",
    name: "Gather & Sell",
    description:
      "Gather a resource until inventory full, sell everything on GE.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Gather Resources",
        strategy_type: "gathering",
        config: { resource_code: "ash_tree", deposit_on_full: false },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Sell on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "ash_plank",
          quantity: 25,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "full_crafter",
    name: "Full Crafter",
    description:
      "Gather materials, craft items, deposit at bank. Complete production loop.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Gather Materials",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: {
          type: "actions_count",
          operator: ">=",
          value: 50,
        },
      },
      {
        id: "step_2",
        name: "Craft Items",
        strategy_type: "crafting",
        config: {
          item_code: "copper_dagger",
          quantity: 10,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "market_flipper",
    name: "Market Flipper",
    description:
      "Buy items at low price, sell at higher price for profit.",
    category: "trading",
    steps: [
      {
        id: "step_1",
        name: "Buy Low",
        strategy_type: "trading",
        config: {
          mode: "buy_materials",
          item_code: "copper_ore",
          quantity: 10,
          max_price: 5,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_2",
        name: "Sell High",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "copper_ore",
          quantity: 10,
          min_price: 8,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 10,
  },

  // ─── Production Chains ───────────────────────────────────────

  {
    id: "cooking_pipeline",
    name: "Cooking Pipeline",
    description:
      "Fish gudgeons, cook them for XP, sell cooked fish on GE. Great for cooking + fishing XP and gold.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Fish Gudgeons",
        strategy_type: "gathering",
        config: { resource_code: "gudgeon_fishing_spot", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Cook Gudgeons",
        strategy_type: "crafting",
        config: {
          item_code: "cooked_gudgeon",
          quantity: 25,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell Cooked Fish",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "cooked_gudgeon",
          quantity: 25,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "jewelry_pipeline",
    name: "Jewelry Pipeline",
    description:
      "Mine copper, craft copper rings, sell on GE. Levels mining + jewelrycrafting while earning gold.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Mine Copper",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Craft Copper Rings",
        strategy_type: "crafting",
        config: {
          item_code: "copper_ring",
          quantity: 10,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell Rings on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "copper_ring",
          quantity: 10,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "armor_pipeline",
    name: "Armor Pipeline",
    description:
      "Mine copper, craft copper boots, sell on GE. Levels mining + gearcrafting.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Mine Copper",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Craft Copper Boots",
        strategy_type: "crafting",
        config: {
          item_code: "copper_boots",
          quantity: 10,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell Boots on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "copper_boots",
          quantity: 10,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "lumber_trade",
    name: "Lumber Trade",
    description:
      "Chop ash trees, sell wood directly on GE. Simple woodcutting money-maker.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Chop Ash Trees",
        strategy_type: "gathering",
        config: { resource_code: "ash_tree", deposit_on_full: false },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Sell Wood on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "ash_plank",
          quantity: 25,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "gold_ore_trader",
    name: "Gold Ore Trader",
    description:
      "Mine gold ore (requires mining 20+), sell on GE. High-value resource pipeline.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Mine Gold Ore",
        strategy_type: "gathering",
        config: { resource_code: "gold_rocks", deposit_on_full: false },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Sell Gold Ore on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "gold_ore",
          quantity: 25,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },

  // ─── Combat + Economy ────────────────────────────────────────

  {
    id: "chicken_farm_economy",
    name: "Chicken Farm & Sell",
    description:
      "Farm chickens for loot and XP, sell drops on GE. Beginner-friendly gold farm.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Farm Chickens",
        strategy_type: "combat",
        config: {
          monster_code: "chicken",
          deposit_loot: true,
          auto_heal_threshold: 40,
        },
        transition: { type: "actions_count", operator: ">=", value: 50 },
      },
      {
        id: "step_2",
        name: "Sell Loot on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "",
          quantity: 0,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "wolf_hunter_economy",
    name: "Wolf Hunter & Sell",
    description:
      "Hunt wolves for valuable drops, sell on GE. Mid-level combat gold farm.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Hunt Wolves",
        strategy_type: "combat",
        config: {
          monster_code: "wolf",
          deposit_loot: true,
          auto_heal_threshold: 50,
        },
        transition: { type: "actions_count", operator: ">=", value: 80 },
      },
      {
        id: "step_2",
        name: "Sell Drops on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "",
          quantity: 0,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },

  // ─── Self-Sustaining Combat ──────────────────────────────────

  {
    id: "combat_with_food",
    name: "Self-Sustaining Fighter",
    description:
      "Fish and cook your own healing food, then fight with consumable healing. No rest downtime.",
    category: "utility",
    steps: [
      {
        id: "step_1",
        name: "Fish Gudgeons",
        strategy_type: "gathering",
        config: { resource_code: "gudgeon_fishing_spot", deposit_on_full: true },
        transition: { type: "actions_count", operator: ">=", value: 30 },
      },
      {
        id: "step_2",
        name: "Cook Food",
        strategy_type: "crafting",
        config: {
          item_code: "cooked_gudgeon",
          quantity: 20,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Fight with Food Healing",
        strategy_type: "combat",
        config: {
          monster_code: "yellow_slime",
          deposit_loot: true,
          auto_heal_threshold: 50,
          heal_method: "consumable",
          consumable_code: "cooked_gudgeon",
        },
        transition: { type: "actions_count", operator: ">=", value: 60 },
      },
    ],
    loop: true,
    max_loops: 0,
  },

  // ─── Leveling Progressions ───────────────────────────────────

  {
    id: "woodcutting_progression",
    name: "Woodcutting Progression",
    description:
      "Chop ash trees until level 10, spruce until 20, then birch trees. Full woodcutting path.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Chop Ash (lv 1-10)",
        strategy_type: "gathering",
        config: { resource_code: "ash_tree", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "woodcutting",
          operator: ">=",
          value: 10,
        },
      },
      {
        id: "step_2",
        name: "Chop Spruce (lv 10-20)",
        strategy_type: "gathering",
        config: { resource_code: "spruce_tree", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "woodcutting",
          operator: ">=",
          value: 20,
        },
      },
      {
        id: "step_3",
        name: "Chop Birch (lv 20+)",
        strategy_type: "gathering",
        config: { resource_code: "birch_tree", deposit_on_full: true },
        transition: null,
      },
    ],
    loop: false,
    max_loops: 0,
  },
  {
    id: "fishing_progression",
    name: "Fishing Progression",
    description:
      "Fish gudgeons until level 10, then switch to shrimp. Levels fishing efficiently.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Fish Gudgeons (lv 1-10)",
        strategy_type: "gathering",
        config: { resource_code: "gudgeon_fishing_spot", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "fishing",
          operator: ">=",
          value: 10,
        },
      },
      {
        id: "step_2",
        name: "Fish Shrimp (lv 10+)",
        strategy_type: "gathering",
        config: { resource_code: "shrimp_fishing_spot", deposit_on_full: true },
        transition: null,
      },
    ],
    loop: false,
    max_loops: 0,
  },
  {
    id: "full_combat_progression",
    name: "Full Combat Progression",
    description:
      "Progress through all monster tiers: chickens → slimes → wolves → skeletons → ogres.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Chickens (beginner)",
        strategy_type: "combat",
        config: {
          monster_code: "chicken",
          deposit_loot: true,
          auto_heal_threshold: 30,
        },
        transition: { type: "actions_count", operator: ">=", value: 80 },
      },
      {
        id: "step_2",
        name: "Yellow Slimes",
        strategy_type: "combat",
        config: {
          monster_code: "yellow_slime",
          deposit_loot: true,
          auto_heal_threshold: 40,
        },
        transition: { type: "actions_count", operator: ">=", value: 120 },
      },
      {
        id: "step_3",
        name: "Green Slimes",
        strategy_type: "combat",
        config: {
          monster_code: "green_slime",
          deposit_loot: true,
          auto_heal_threshold: 50,
        },
        transition: { type: "actions_count", operator: ">=", value: 150 },
      },
      {
        id: "step_4",
        name: "Wolves",
        strategy_type: "combat",
        config: {
          monster_code: "wolf",
          deposit_loot: true,
          auto_heal_threshold: 50,
        },
        transition: { type: "actions_count", operator: ">=", value: 200 },
      },
      {
        id: "step_5",
        name: "Skeletons",
        strategy_type: "combat",
        config: {
          monster_code: "skeleton",
          deposit_loot: true,
          auto_heal_threshold: 60,
        },
        transition: { type: "actions_count", operator: ">=", value: 250 },
      },
      {
        id: "step_6",
        name: "Ogres (endgame)",
        strategy_type: "combat",
        config: {
          monster_code: "ogre",
          deposit_loot: true,
          auto_heal_threshold: 60,
        },
        transition: null,
      },
    ],
    loop: false,
    max_loops: 0,
  },
  {
    id: "gathering_rotation",
    name: "Gathering Rotation",
    description:
      "Rotate between mining, woodcutting, and fishing in timed sessions. Level all gathering skills evenly.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Mining Session",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: { type: "timer", seconds: 900 },
      },
      {
        id: "step_2",
        name: "Woodcutting Session",
        strategy_type: "gathering",
        config: { resource_code: "ash_tree", deposit_on_full: true },
        transition: { type: "timer", seconds: 900 },
      },
      {
        id: "step_3",
        name: "Fishing Session",
        strategy_type: "gathering",
        config: { resource_code: "gudgeon_fishing_spot", deposit_on_full: true },
        transition: { type: "timer", seconds: 900 },
      },
    ],
    loop: true,
    max_loops: 0,
  },

  // ─── Trading / Economy ───────────────────────────────────────

  {
    id: "crafting_arbitrage",
    name: "Crafting Arbitrage",
    description:
      "Buy cheap copper ore on GE, craft into daggers, sell daggers at a profit. Pure trading profit.",
    category: "trading",
    steps: [
      {
        id: "step_1",
        name: "Buy Copper Ore",
        strategy_type: "trading",
        config: {
          mode: "buy_materials",
          item_code: "copper_ore",
          quantity: 20,
          max_price: 4,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_2",
        name: "Craft Daggers",
        strategy_type: "crafting",
        config: {
          item_code: "copper_dagger",
          quantity: 10,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell Daggers",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "copper_dagger",
          quantity: 10,
          min_price: 6,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 20,
  },

  // ─── Utility / Mixed ─────────────────────────────────────────

  {
    id: "daily_grind",
    name: "Daily Grind",
    description:
      "Balanced routine: complete tasks, gather resources, sell on GE. A bit of everything.",
    category: "utility",
    steps: [
      {
        id: "step_1",
        name: "Complete Tasks",
        strategy_type: "task",
        config: { max_tasks: 3, auto_exchange: true },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_2",
        name: "Gather Resources",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: { type: "actions_count", operator: ">=", value: 40 },
      },
      {
        id: "step_3",
        name: "Sell Everything",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "",
          quantity: 0,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "crafting_xp_rush",
    name: "Crafting XP Rush",
    description:
      "Craft items and recycle them for fast crafting XP. No selling - pure skill training.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Mine Materials",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Craft & Recycle",
        strategy_type: "crafting",
        config: {
          item_code: "copper_dagger",
          quantity: 10,
          gather_materials: false,
          recycle_excess: true,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "tasks_and_combat",
    name: "Tasks & Combat",
    description:
      "Alternate between task completion and combat grinding. Earn task rewards and combat XP.",
    category: "utility",
    steps: [
      {
        id: "step_1",
        name: "Complete Tasks",
        strategy_type: "task",
        config: { max_tasks: 3, auto_exchange: true },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_2",
        name: "Combat Session",
        strategy_type: "combat",
        config: {
          monster_code: "yellow_slime",
          deposit_loot: true,
          auto_heal_threshold: 50,
        },
        transition: { type: "actions_count", operator: ">=", value: 60 },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "spruce_pipeline",
    name: "Spruce Pipeline",
    description:
      "Chop spruce trees, sell wood on GE. Mid-level woodcutting money-maker (requires woodcutting 10+).",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Chop Spruce Trees",
        strategy_type: "gathering",
        config: { resource_code: "spruce_tree", deposit_on_full: false },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Sell Spruce on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "spruce_plank",
          quantity: 25,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "shrimp_cooking_pipeline",
    name: "Shrimp Cooking Pipeline",
    description:
      "Fish shrimp, cook them, sell on GE. Mid-level fishing + cooking money-maker (requires fishing 10+).",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Fish Shrimp",
        strategy_type: "gathering",
        config: { resource_code: "shrimp_fishing_spot", deposit_on_full: true },
        transition: { type: "inventory_full" },
      },
      {
        id: "step_2",
        name: "Cook Shrimp",
        strategy_type: "crafting",
        config: {
          item_code: "cooked_shrimp",
          quantity: 25,
          gather_materials: false,
        },
        transition: { type: "strategy_complete" },
      },
      {
        id: "step_3",
        name: "Sell Cooked Shrimp",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "cooked_shrimp",
          quantity: 25,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "full_gathering_to_20",
    name: "Full Gathering to 20",
    description:
      "Level mining, woodcutting, and fishing all to 20. Automatically progresses through tiers.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Mining to 10",
        strategy_type: "gathering",
        config: { resource_code: "copper_rocks", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "mining",
          operator: ">=",
          value: 10,
        },
      },
      {
        id: "step_2",
        name: "Woodcutting to 10",
        strategy_type: "gathering",
        config: { resource_code: "ash_tree", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "woodcutting",
          operator: ">=",
          value: 10,
        },
      },
      {
        id: "step_3",
        name: "Fishing to 10",
        strategy_type: "gathering",
        config: { resource_code: "gudgeon_fishing_spot", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "fishing",
          operator: ">=",
          value: 10,
        },
      },
      {
        id: "step_4",
        name: "Mining to 20",
        strategy_type: "gathering",
        config: { resource_code: "iron_rocks", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "mining",
          operator: ">=",
          value: 20,
        },
      },
      {
        id: "step_5",
        name: "Woodcutting to 20",
        strategy_type: "gathering",
        config: { resource_code: "spruce_tree", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "woodcutting",
          operator: ">=",
          value: 20,
        },
      },
      {
        id: "step_6",
        name: "Fishing to 20",
        strategy_type: "gathering",
        config: { resource_code: "shrimp_fishing_spot", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "fishing",
          operator: ">=",
          value: 20,
        },
      },
    ],
    loop: false,
    max_loops: 0,
  },
  {
    id: "skeleton_grinder_economy",
    name: "Skeleton Grinder & Sell",
    description:
      "Farm skeletons for bones and rare drops, sell on GE. High-level combat gold farm.",
    category: "production",
    steps: [
      {
        id: "step_1",
        name: "Farm Skeletons",
        strategy_type: "combat",
        config: {
          monster_code: "skeleton",
          deposit_loot: true,
          auto_heal_threshold: 60,
        },
        transition: { type: "actions_count", operator: ">=", value: 100 },
      },
      {
        id: "step_2",
        name: "Sell Drops on GE",
        strategy_type: "trading",
        config: {
          mode: "sell_loot",
          item_code: "",
          quantity: 0,
          min_price: 1,
        },
        transition: { type: "strategy_complete" },
      },
    ],
    loop: true,
    max_loops: 0,
  },
  {
    id: "iron_to_gold_mining",
    name: "Mining: Iron to Gold",
    description:
      "Continue mining progression from iron (level 10) to gold (level 20+). For players who completed copper already.",
    category: "leveling",
    steps: [
      {
        id: "step_1",
        name: "Mine Iron (lv 10-20)",
        strategy_type: "gathering",
        config: { resource_code: "iron_rocks", deposit_on_full: true },
        transition: {
          type: "skill_level",
          skill: "mining",
          operator: ">=",
          value: 20,
        },
      },
      {
        id: "step_2",
        name: "Mine Gold (lv 20+)",
        strategy_type: "gathering",
        config: { resource_code: "gold_rocks", deposit_on_full: true },
        transition: null,
      },
    ],
    loop: false,
    max_loops: 0,
  },
];

export const WORKFLOW_CATEGORY_LABELS: Record<string, string> = {
  production: "Production",
  leveling: "Leveling",
  trading: "Trading",
  utility: "Utility",
};

export const WORKFLOW_CATEGORY_COLORS: Record<string, string> = {
  production: "text-blue-400",
  leveling: "text-cyan-400",
  trading: "text-yellow-400",
  utility: "text-purple-400",
};

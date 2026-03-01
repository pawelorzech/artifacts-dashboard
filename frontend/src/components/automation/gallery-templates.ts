import type {
  CombatConfig,
  GatheringConfig,
  CraftingConfig,
  TradingConfig,
  TaskConfig,
  LevelingConfig,
} from "@/lib/types";

export type StrategyType =
  | "combat"
  | "gathering"
  | "crafting"
  | "trading"
  | "task"
  | "leveling";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface GalleryTemplate {
  id: string;
  name: string;
  description: string;
  strategy_type: StrategyType;
  config: Record<string, unknown>;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  /** Suggested minimum character level */
  min_level: number;
  /** Relevant skill and its minimum level, if applicable */
  skill_requirement?: { skill: string; level: number };
}

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

// ---------- Combat Templates ----------

const COMBAT_TEMPLATES: GalleryTemplate[] = [
  {
    id: "combat-chicken-farm",
    name: "Chicken Farm",
    description:
      "Fight chickens for feathers, raw chicken, and early XP. Great first automation for new characters.",
    strategy_type: "combat",
    config: {
      monster_code: "chicken",
      auto_heal_threshold: 40,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "beginner",
    tags: ["xp", "gold", "food", "starter"],
    min_level: 1,
  },
  {
    id: "combat-yellow-slime",
    name: "Yellow Slime Grinder",
    description:
      "Farm yellow slimes for slimeballs and steady XP. Low risk with auto-healing.",
    strategy_type: "combat",
    config: {
      monster_code: "yellow_slime",
      auto_heal_threshold: 50,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "beginner",
    tags: ["xp", "drops", "slime"],
    min_level: 1,
  },
  {
    id: "combat-green-slime",
    name: "Green Slime Grinder",
    description:
      "Farm green slimes for slimeballs and consistent XP. Slight step up from chickens.",
    strategy_type: "combat",
    config: {
      monster_code: "green_slime",
      auto_heal_threshold: 50,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "beginner",
    tags: ["xp", "drops", "slime"],
    min_level: 3,
  },
  {
    id: "combat-blue-slime",
    name: "Blue Slime Farmer",
    description:
      "Farm blue slimes for water-element drops and good mid-level XP.",
    strategy_type: "combat",
    config: {
      monster_code: "blue_slime",
      auto_heal_threshold: 50,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "beginner",
    tags: ["xp", "drops", "slime", "water"],
    min_level: 5,
  },
  {
    id: "combat-red-slime",
    name: "Red Slime Hunter",
    description:
      "Take on red slimes for fire-element drops. Needs decent gear and healing.",
    strategy_type: "combat",
    config: {
      monster_code: "red_slime",
      auto_heal_threshold: 60,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "intermediate",
    tags: ["xp", "drops", "slime", "fire"],
    min_level: 7,
  },
  {
    id: "combat-wolf-hunter",
    name: "Wolf Hunter",
    description:
      "Hunt wolves for wolf hair, bones, and solid XP. Requires reasonable combat stats.",
    strategy_type: "combat",
    config: {
      monster_code: "wolf",
      auto_heal_threshold: 60,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "intermediate",
    tags: ["xp", "wolf hair", "bones"],
    min_level: 10,
  },
  {
    id: "combat-skeleton",
    name: "Skeleton Slayer",
    description:
      "Clear skeletons for bone drops and strong XP. Bring good gear.",
    strategy_type: "combat",
    config: {
      monster_code: "skeleton",
      auto_heal_threshold: 60,
      heal_method: "rest",
      min_inventory_slots: 3,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "intermediate",
    tags: ["xp", "bones", "undead"],
    min_level: 15,
  },
  {
    id: "combat-ogre",
    name: "Ogre Brawler",
    description:
      "Fight ogres for rare drops and high XP. Make sure your character is well-geared.",
    strategy_type: "combat",
    config: {
      monster_code: "ogre",
      auto_heal_threshold: 70,
      heal_method: "rest",
      min_inventory_slots: 5,
      deposit_loot: true,
    } satisfies CombatConfig,
    category: "combat",
    difficulty: "advanced",
    tags: ["xp", "rare drops", "high level"],
    min_level: 20,
  },
];

// ---------- Gathering Templates ----------

const GATHERING_TEMPLATES: GalleryTemplate[] = [
  {
    id: "gather-copper-ore",
    name: "Copper Miner",
    description:
      "Mine copper ore, the most basic mining resource. Auto-deposits at the bank when full.",
    strategy_type: "gathering",
    config: {
      resource_code: "copper_ore",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "beginner",
    tags: ["mining", "copper", "ore", "starter"],
    min_level: 1,
    skill_requirement: { skill: "mining", level: 1 },
  },
  {
    id: "gather-iron-ore",
    name: "Iron Miner",
    description:
      "Mine iron ore for crafting iron equipment. Requires mining level 10.",
    strategy_type: "gathering",
    config: {
      resource_code: "iron_ore",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "intermediate",
    tags: ["mining", "iron", "ore"],
    min_level: 1,
    skill_requirement: { skill: "mining", level: 10 },
  },
  {
    id: "gather-gold-ore",
    name: "Gold Miner",
    description:
      "Mine gold ore for valuable crafting materials. Requires mining level 20.",
    strategy_type: "gathering",
    config: {
      resource_code: "gold_ore",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "advanced",
    tags: ["mining", "gold", "ore", "valuable"],
    min_level: 1,
    skill_requirement: { skill: "mining", level: 20 },
  },
  {
    id: "gather-ash-tree",
    name: "Ash Woodcutter",
    description:
      "Chop ash trees for ash wood. The starter woodcutting resource.",
    strategy_type: "gathering",
    config: {
      resource_code: "ash_tree",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "beginner",
    tags: ["woodcutting", "wood", "ash", "starter"],
    min_level: 1,
    skill_requirement: { skill: "woodcutting", level: 1 },
  },
  {
    id: "gather-spruce-tree",
    name: "Spruce Woodcutter",
    description:
      "Chop spruce trees for spruce wood. Requires woodcutting level 10.",
    strategy_type: "gathering",
    config: {
      resource_code: "spruce_tree",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "intermediate",
    tags: ["woodcutting", "wood", "spruce"],
    min_level: 1,
    skill_requirement: { skill: "woodcutting", level: 10 },
  },
  {
    id: "gather-birch-tree",
    name: "Birch Woodcutter",
    description:
      "Chop birch trees for birch wood. Requires woodcutting level 20.",
    strategy_type: "gathering",
    config: {
      resource_code: "birch_tree",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "advanced",
    tags: ["woodcutting", "wood", "birch"],
    min_level: 1,
    skill_requirement: { skill: "woodcutting", level: 20 },
  },
  {
    id: "gather-gudgeon",
    name: "Gudgeon Fisher",
    description:
      "Fish gudgeon, the basic fishing resource. Great for leveling cooking too.",
    strategy_type: "gathering",
    config: {
      resource_code: "gudgeon",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "beginner",
    tags: ["fishing", "fish", "gudgeon", "starter", "cooking"],
    min_level: 1,
    skill_requirement: { skill: "fishing", level: 1 },
  },
  {
    id: "gather-shrimp",
    name: "Shrimp Fisher",
    description:
      "Fish shrimp for cooking materials. Requires fishing level 10.",
    strategy_type: "gathering",
    config: {
      resource_code: "shrimp",
      deposit_on_full: true,
      max_loops: 0,
    } satisfies GatheringConfig,
    category: "gathering",
    difficulty: "intermediate",
    tags: ["fishing", "fish", "shrimp", "cooking"],
    min_level: 1,
    skill_requirement: { skill: "fishing", level: 10 },
  },
];

// ---------- Crafting Templates ----------

const CRAFTING_TEMPLATES: GalleryTemplate[] = [
  {
    id: "craft-copper-dagger",
    name: "Copper Dagger Smith",
    description:
      "Craft copper daggers for weaponcrafting XP. Can auto-gather materials.",
    strategy_type: "crafting",
    config: {
      item_code: "copper_dagger",
      quantity: 0,
      gather_materials: true,
      recycle_excess: true,
    } satisfies CraftingConfig,
    category: "crafting",
    difficulty: "beginner",
    tags: ["weaponcrafting", "copper", "weapon", "starter"],
    min_level: 1,
    skill_requirement: { skill: "weaponcrafting", level: 1 },
  },
  {
    id: "craft-copper-boots",
    name: "Copper Boots Crafter",
    description:
      "Craft copper boots for gearcrafting XP. Auto-gathers copper and leather.",
    strategy_type: "crafting",
    config: {
      item_code: "copper_boots",
      quantity: 0,
      gather_materials: true,
      recycle_excess: true,
    } satisfies CraftingConfig,
    category: "crafting",
    difficulty: "beginner",
    tags: ["gearcrafting", "copper", "armor", "starter"],
    min_level: 1,
    skill_requirement: { skill: "gearcrafting", level: 1 },
  },
  {
    id: "craft-copper-ring",
    name: "Copper Ring Jeweler",
    description:
      "Craft copper rings for jewelrycrafting XP. Good starter jewelry.",
    strategy_type: "crafting",
    config: {
      item_code: "copper_ring",
      quantity: 0,
      gather_materials: true,
      recycle_excess: true,
    } satisfies CraftingConfig,
    category: "crafting",
    difficulty: "beginner",
    tags: ["jewelrycrafting", "copper", "ring", "starter"],
    min_level: 1,
    skill_requirement: { skill: "jewelrycrafting", level: 1 },
  },
  {
    id: "craft-cooked-gudgeon",
    name: "Gudgeon Cook",
    description:
      "Cook gudgeon for cooking XP and healing food. Pairs well with fishing.",
    strategy_type: "crafting",
    config: {
      item_code: "cooked_gudgeon",
      quantity: 0,
      gather_materials: true,
      recycle_excess: false,
    } satisfies CraftingConfig,
    category: "crafting",
    difficulty: "beginner",
    tags: ["cooking", "food", "healing", "starter"],
    min_level: 1,
    skill_requirement: { skill: "cooking", level: 1 },
  },
  {
    id: "craft-iron-sword",
    name: "Iron Sword Smith",
    description:
      "Craft iron swords for mid-level weaponcrafting XP and usable weapons.",
    strategy_type: "crafting",
    config: {
      item_code: "iron_sword",
      quantity: 0,
      gather_materials: true,
      recycle_excess: true,
    } satisfies CraftingConfig,
    category: "crafting",
    difficulty: "intermediate",
    tags: ["weaponcrafting", "iron", "weapon"],
    min_level: 1,
    skill_requirement: { skill: "weaponcrafting", level: 10 },
  },
];

// ---------- Trading Templates ----------

const TRADING_TEMPLATES: GalleryTemplate[] = [
  {
    id: "trade-sell-loot",
    name: "Loot Seller",
    description:
      "Automatically sell all loot from your bank on the Grand Exchange at market price.",
    strategy_type: "trading",
    config: {
      mode: "sell_loot",
      item_code: "",
      min_price: 0,
      max_price: 0,
      quantity: 0,
    } satisfies TradingConfig,
    category: "trading",
    difficulty: "beginner",
    tags: ["gold", "sell", "loot", "passive income"],
    min_level: 1,
  },
  {
    id: "trade-buy-copper",
    name: "Copper Buyer",
    description:
      "Buy copper ore from the Grand Exchange for crafting. Set price limits to avoid overpaying.",
    strategy_type: "trading",
    config: {
      mode: "buy_materials",
      item_code: "copper_ore",
      min_price: 0,
      max_price: 10,
      quantity: 100,
    } satisfies TradingConfig,
    category: "trading",
    difficulty: "intermediate",
    tags: ["buy", "copper", "materials"],
    min_level: 1,
  },
  {
    id: "trade-flip-items",
    name: "Market Flipper",
    description:
      "Buy items low and sell high on the Grand Exchange. Configure item and price range for profit.",
    strategy_type: "trading",
    config: {
      mode: "flip",
      item_code: "",
      min_price: 0,
      max_price: 0,
      quantity: 0,
    } satisfies TradingConfig,
    category: "trading",
    difficulty: "advanced",
    tags: ["gold", "flip", "profit", "arbitrage"],
    min_level: 1,
  },
];

// ---------- Utility Templates ----------

const UTILITY_TEMPLATES: GalleryTemplate[] = [
  {
    id: "util-task-runner",
    name: "Auto Task Runner",
    description:
      "Automatically accept, complete, and turn in NPC tasks for task coins and bonus XP.",
    strategy_type: "task",
    config: {} satisfies TaskConfig,
    category: "utility",
    difficulty: "beginner",
    tags: ["tasks", "coins", "xp", "passive"],
    min_level: 1,
  },
  {
    id: "util-skill-leveler",
    name: "Skill Leveler",
    description:
      "Automatically chooses the most efficient activity to level up your skills. Set a target skill or let it auto-detect.",
    strategy_type: "leveling",
    config: {} satisfies LevelingConfig,
    category: "utility",
    difficulty: "beginner",
    tags: ["xp", "leveling", "skills", "auto"],
    min_level: 1,
  },
  {
    id: "util-mining-leveler",
    name: "Mining Leveler",
    description:
      "Focus on leveling mining by choosing the best available ore for your current level.",
    strategy_type: "leveling",
    config: {
      target_skill: "mining",
    } satisfies LevelingConfig,
    category: "utility",
    difficulty: "beginner",
    tags: ["xp", "mining", "leveling"],
    min_level: 1,
  },
  {
    id: "util-woodcutting-leveler",
    name: "Woodcutting Leveler",
    description:
      "Focus on leveling woodcutting by chopping the best available trees.",
    strategy_type: "leveling",
    config: {
      target_skill: "woodcutting",
    } satisfies LevelingConfig,
    category: "utility",
    difficulty: "beginner",
    tags: ["xp", "woodcutting", "leveling"],
    min_level: 1,
  },
  {
    id: "util-fishing-leveler",
    name: "Fishing Leveler",
    description:
      "Focus on leveling fishing by catching the best available fish.",
    strategy_type: "leveling",
    config: {
      target_skill: "fishing",
    } satisfies LevelingConfig,
    category: "utility",
    difficulty: "beginner",
    tags: ["xp", "fishing", "leveling"],
    min_level: 1,
  },
];

// ---------- Exports ----------

export const GALLERY_TEMPLATES: GalleryTemplate[] = [
  ...COMBAT_TEMPLATES,
  ...GATHERING_TEMPLATES,
  ...CRAFTING_TEMPLATES,
  ...TRADING_TEMPLATES,
  ...UTILITY_TEMPLATES,
].sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);

export const GALLERY_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "combat", label: "Combat" },
  { key: "gathering", label: "Gathering" },
  { key: "crafting", label: "Crafting" },
  { key: "trading", label: "Trading" },
  { key: "utility", label: "Utility" },
] as const;

export type GalleryCategoryKey = (typeof GALLERY_CATEGORIES)[number]["key"];

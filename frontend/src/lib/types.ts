export interface InventorySlot {
  slot: number;
  code: string;
  quantity: number;
}

export interface Character {
  name: string;
  account: string;
  skin: string;
  level: number;
  xp: number;
  max_xp: number;
  gold: number;
  speed: number;
  hp: number;
  max_hp: number;
  haste: number;
  critical_strike: number;
  stamina: number;

  attack_fire: number;
  attack_earth: number;
  attack_water: number;
  attack_air: number;

  dmg_fire: number;
  dmg_earth: number;
  dmg_water: number;
  dmg_air: number;

  res_fire: number;
  res_earth: number;
  res_water: number;
  res_air: number;

  x: number;
  y: number;
  cooldown: number;
  cooldown_expiration: string | null;

  weapon_slot: string;
  shield_slot: string;
  helmet_slot: string;
  body_armor_slot: string;
  leg_armor_slot: string;
  boots_slot: string;
  ring1_slot: string;
  ring2_slot: string;
  amulet_slot: string;
  artifact1_slot: string;
  artifact2_slot: string;
  artifact3_slot: string;
  utility1_slot: string;
  utility1_slot_quantity: number;
  utility2_slot: string;
  utility2_slot_quantity: number;

  inventory_max_items: number;
  inventory: InventorySlot[];

  task: string;
  task_type: string;
  task_progress: number;
  task_total: number;

  mining_level: number;
  mining_xp: number;
  woodcutting_level: number;
  woodcutting_xp: number;
  fishing_level: number;
  fishing_xp: number;
  weaponcrafting_level: number;
  weaponcrafting_xp: number;
  gearcrafting_level: number;
  gearcrafting_xp: number;
  jewelrycrafting_level: number;
  jewelrycrafting_xp: number;
  cooking_level: number;
  cooking_xp: number;
  alchemy_level: number;
  alchemy_xp: number;
}

export interface Effect {
  name: string;
  value: number;
}

export interface CraftItem {
  code: string;
  quantity: number;
}

export interface Craft {
  skill: string;
  level: number;
  items: CraftItem[];
  quantity: number;
}

export interface Item {
  name: string;
  code: string;
  level: number;
  type: string;
  subtype: string;
  description: string;
  effects: Effect[];
  craft?: Craft;
}

export interface Drop {
  code: string;
  rate: number;
  min_quantity: number;
  max_quantity: number;
}

export interface Monster {
  name: string;
  code: string;
  level: number;
  hp: number;
  attack_fire: number;
  attack_earth: number;
  attack_water: number;
  attack_air: number;
  res_fire: number;
  res_earth: number;
  res_water: number;
  res_air: number;
  min_gold: number;
  max_gold: number;
  drops: Drop[];
}

export interface Resource {
  name: string;
  code: string;
  skill: string;
  level: number;
  drops: Drop[];
}

export interface MapTile {
  name: string;
  skin: string;
  x: number;
  y: number;
  layer: string;
  content?: {
    type: string;
    code: string;
  };
}

export interface DashboardData {
  characters: Character[];
  server_status?: Record<string, unknown>;
}

export interface BankData {
  details: Record<string, unknown>;
  items: Record<string, unknown>[];
}

// ---------- Automation Types ----------

export interface AutomationConfig {
  id: number;
  name: string;
  character_name: string;
  strategy_type:
    | "combat"
    | "gathering"
    | "crafting"
    | "trading"
    | "task"
    | "leveling";
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: number;
  config_id: number;
  status: "running" | "paused" | "stopped" | "error";
  started_at: string;
  stopped_at: string | null;
  actions_count: number;
  error_message: string | null;
}

export interface AutomationLog {
  id: number;
  run_id: number;
  action_type: string;
  details: Record<string, unknown>;
  success: boolean;
  created_at: string;
}

export interface AutomationStatus {
  config_id: number;
  character_name: string;
  strategy_type: string;
  status: string;
  run_id: number | null;
  actions_count: number;
  latest_logs: AutomationLog[];
}

export interface CombatConfig {
  monster_code: string;
  auto_heal_threshold: number;
  heal_method: "rest" | "consumable";
  consumable_code?: string;
  min_inventory_slots: number;
  deposit_loot: boolean;
}

export interface GatheringConfig {
  resource_code: string;
  deposit_on_full: boolean;
  max_loops: number;
}

export interface CraftingConfig {
  item_code: string;
  quantity: number;
  gather_materials: boolean;
  recycle_excess: boolean;
}

export interface TradingConfig {
  mode: "sell_loot" | "buy_materials" | "flip";
  item_code: string;
  min_price: number;
  max_price: number;
  quantity: number;
}

export interface TaskConfig {
  // No specific config needed
}

export interface LevelingConfig {
  target_skill?: string;
}

// ---------- Workflow Types ----------

export interface TransitionCondition {
  type:
    | "strategy_complete"
    | "loops_completed"
    | "inventory_full"
    | "inventory_item_count"
    | "bank_item_count"
    | "skill_level"
    | "gold_amount"
    | "actions_count"
    | "timer";
  operator: ">=" | "<=" | "==" | ">" | "<";
  value: number;
  item_code: string;
  skill: string;
  seconds: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  strategy_type:
    | "combat"
    | "gathering"
    | "crafting"
    | "trading"
    | "task"
    | "leveling";
  config: Record<string, unknown>;
  transition: TransitionCondition | null;
}

export interface WorkflowConfig {
  id: number;
  name: string;
  character_name: string;
  description: string;
  steps: WorkflowStep[];
  loop: boolean;
  max_loops: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: number;
  workflow_id: number;
  status: "running" | "paused" | "stopped" | "completed" | "error";
  current_step_index: number;
  current_step_id: string;
  loop_count: number;
  total_actions_count: number;
  step_actions_count: number;
  started_at: string;
  stopped_at: string | null;
  error_message: string | null;
  step_history: Record<string, unknown>[];
}

export interface WorkflowStatus {
  workflow_id: number;
  character_name: string;
  status: string;
  run_id: number | null;
  current_step_index: number;
  current_step_id: string;
  total_steps: number;
  loop_count: number;
  total_actions_count: number;
  step_actions_count: number;
  strategy_state: string;
}

// ---------- Pipeline Types ----------

export interface CharacterStep {
  id: string;
  character_name: string;
  strategy_type:
    | "combat"
    | "gathering"
    | "crafting"
    | "trading"
    | "task"
    | "leveling";
  config: Record<string, unknown>;
  transition: TransitionCondition | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  character_steps: CharacterStep[];
}

export interface PipelineConfig {
  id: number;
  name: string;
  description: string;
  stages: PipelineStage[];
  loop: boolean;
  max_loops: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: number;
  pipeline_id: number;
  status: "running" | "paused" | "stopped" | "completed" | "error";
  current_stage_index: number;
  current_stage_id: string;
  loop_count: number;
  total_actions_count: number;
  character_states: Record<
    string,
    {
      status: string;
      step_id: string;
      actions_count: number;
      strategy_state: string;
      error: string | null;
    }
  >;
  stage_history: Record<string, unknown>[];
  started_at: string;
  stopped_at: string | null;
  error_message: string | null;
}

export interface PipelineCharacterState {
  character_name: string;
  status: string;
  step_id: string;
  actions_count: number;
  strategy_state: string;
  error: string | null;
}

export interface PipelineStatus {
  pipeline_id: number;
  status: string;
  run_id: number | null;
  current_stage_index: number;
  current_stage_id: string;
  total_stages: number;
  loop_count: number;
  total_actions_count: number;
  character_states: PipelineCharacterState[];
}

// ---------- Grand Exchange Types ----------

export interface GEOrder {
  id: string;
  code: string;
  type: "buy" | "sell";
  account?: string | null;
  price: number;
  quantity: number;
  created_at: string;
}

export interface GEHistoryEntry {
  order_id: string;
  seller: string;
  buyer: string;
  code: string;
  quantity: number;
  price: number;
  sold_at: string;
}

export interface PricePoint {
  item_code: string;
  buy_price: number;
  sell_price: number;
  volume: number;
  captured_at: string;
}

// ---------- Event Types ----------

export interface ActiveGameEvent {
  name: string;
  code: string;
  content: { type: string; code: string };
  maps: { map_id: number; x: number; y: number; layer: string; skin: string }[];
  duration: number;
  rate: number;
}

export interface HistoricalEvent {
  id: number;
  event_type: string;
  event_data: Record<string, unknown>;
  character_name?: string;
  map_x?: number;
  map_y?: number;
  created_at: string;
}

/** @deprecated Use ActiveGameEvent or HistoricalEvent */
export interface GameEvent {
  id?: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
}

// ---------- Log & Analytics Types ----------

export interface ActionLog {
  id: number;
  character_name?: string;
  action_type: string;
  details: Record<string, unknown>;
  success: boolean;
  created_at: string;
  cooldown?: number;
}

export interface PaginatedLogs {
  logs: ActionLog[];
  total: number;
  page: number;
  pages: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface AnalyticsData {
  xp_history: TimeSeriesPoint[];
  gold_history: TimeSeriesPoint[];
  actions_per_hour: number;
}

// ---------- App Error Types ----------

export interface AppError {
  id: number;
  severity: string;
  source: string;
  error_type: string;
  message: string;
  stack_trace?: string | null;
  context?: Record<string, unknown> | null;
  correlation_id?: string | null;
  resolved: boolean;
  created_at: string;
}

export interface PaginatedErrors {
  errors: AppError[];
  total: number;
  page: number;
  pages: number;
}

export interface ErrorStats {
  total: number;
  unresolved: number;
  last_hour: number;
  by_severity: Record<string, number>;
  by_source: Record<string, number>;
}

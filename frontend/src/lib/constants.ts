export const SKILLS = [
  { key: "mining", label: "Mining", color: "amber" },
  { key: "woodcutting", label: "Woodcutting", color: "green" },
  { key: "fishing", label: "Fishing", color: "blue" },
  { key: "weaponcrafting", label: "Weaponcrafting", color: "red" },
  { key: "gearcrafting", label: "Gearcrafting", color: "slate" },
  { key: "jewelrycrafting", label: "Jewelrycrafting", color: "purple" },
  { key: "cooking", label: "Cooking", color: "orange" },
  { key: "alchemy", label: "Alchemy", color: "emerald" },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];

export const EQUIPMENT_SLOTS = [
  { key: "weapon_slot", label: "Weapon" },
  { key: "rune_slot", label: "Rune" },
  { key: "shield_slot", label: "Shield" },
  { key: "helmet_slot", label: "Helmet" },
  { key: "body_armor_slot", label: "Body Armor" },
  { key: "leg_armor_slot", label: "Leg Armor" },
  { key: "boots_slot", label: "Boots" },
  { key: "ring1_slot", label: "Ring 1" },
  { key: "ring2_slot", label: "Ring 2" },
  { key: "amulet_slot", label: "Amulet" },
  { key: "artifact1_slot", label: "Artifact 1" },
  { key: "artifact2_slot", label: "Artifact 2" },
  { key: "artifact3_slot", label: "Artifact 3" },
  { key: "utility1_slot", label: "Utility 1" },
  { key: "utility2_slot", label: "Utility 2" },
  { key: "bag_slot", label: "Bag" },
] as const;

export type EquipmentSlotKey = (typeof EQUIPMENT_SLOTS)[number]["key"];

export const ELEMENTS = [
  { key: "fire", label: "Fire", color: "text-orange-400", bg: "bg-orange-400/20" },
  { key: "earth", label: "Earth", color: "text-green-400", bg: "bg-green-400/20" },
  { key: "water", label: "Water", color: "text-blue-400", bg: "bg-blue-400/20" },
  { key: "air", label: "Air", color: "text-purple-400", bg: "bg-purple-400/20" },
] as const;

export type ElementKey = (typeof ELEMENTS)[number]["key"];

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/automations", label: "Automations", icon: "Bot" },
  { href: "/map", label: "Map", icon: "Map" },
  { href: "/bank", label: "Bank", icon: "Landmark" },
  { href: "/exchange", label: "Exchange", icon: "ArrowLeftRight" },
  { href: "/events", label: "Events", icon: "Zap" },
  { href: "/logs", label: "Logs", icon: "ScrollText" },
  { href: "/errors", label: "Errors", icon: "AlertTriangle" },
  { href: "/analytics", label: "Analytics", icon: "BarChart3" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;

export const SKILL_COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  slate: "bg-slate-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  emerald: "bg-emerald-500",
};

export const SKILL_COLOR_TEXT_MAP: Record<string, string> = {
  amber: "text-amber-400",
  green: "text-green-400",
  blue: "text-blue-400",
  red: "text-red-400",
  slate: "text-slate-400",
  purple: "text-purple-400",
  orange: "text-orange-400",
  emerald: "text-emerald-400",
};

"use client";

import {
  Heart,
  Zap,
  MapPin,
  Coins,
  Gauge,
  Timer,
  Crosshair,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ELEMENTS } from "@/lib/constants";
import type { Character } from "@/lib/types";

interface StatsPanelProps {
  character: Character;
}

function StatRow({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className={`size-3.5 ${className || ""}`} />}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function StatsPanel({ character }: StatsPanelProps) {
  const xpPercent =
    character.max_xp > 0
      ? Math.round((character.xp / character.max_xp) * 100)
      : 0;
  const hpPercent =
    character.max_hp > 0
      ? Math.round((character.hp / character.max_hp) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Character Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level + XP */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Level {character.level}
            </span>
            <span className="text-xs text-muted-foreground">
              {character.xp.toLocaleString()} / {character.max_xp.toLocaleString()} XP ({xpPercent}%)
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* HP */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Heart className="size-3.5 text-red-400" />
              <span>HP</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {character.hp} / {character.max_hp}
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        <Separator />

        {/* Core stats */}
        <div>
          <StatRow
            label="Position"
            value={`(${character.x}, ${character.y})`}
            icon={MapPin}
          />
          <StatRow
            label="Gold"
            value={character.gold.toLocaleString()}
            icon={Coins}
            className="text-amber-400"
          />
          <StatRow
            label="Speed"
            value={character.speed}
            icon={Gauge}
          />
          <StatRow
            label="Haste"
            value={character.haste}
            icon={Timer}
          />
          <StatRow
            label="Critical Strike"
            value={character.critical_strike}
            icon={Crosshair}
          />
          <StatRow
            label="Stamina"
            value={character.stamina}
            icon={Shield}
          />
        </div>

        <Separator />

        {/* Elemental stats */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            Elemental Stats
          </h4>

          {/* Header */}
          <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground px-1">
            <span>Element</span>
            <span className="text-center">Attack</span>
            <span className="text-center">Damage</span>
            <span className="text-center">Resist</span>
          </div>

          {ELEMENTS.map((element) => {
            const attack =
              character[`attack_${element.key}` as keyof Character] as number;
            const dmg =
              character[`dmg_${element.key}` as keyof Character] as number;
            const res =
              character[`res_${element.key}` as keyof Character] as number;

            return (
              <div
                key={element.key}
                className="grid grid-cols-4 gap-2 items-center text-sm px-1"
              >
                <span className={`font-medium ${element.color}`}>
                  {element.label}
                </span>
                <span className="text-center text-foreground">{attack}</span>
                <span className="text-center text-foreground">
                  {dmg > 0 ? `+${dmg}` : dmg}
                </span>
                <span className="text-center text-foreground">{res}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

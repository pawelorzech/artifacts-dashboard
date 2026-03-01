"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Coins, Swords, Shield, Clock, Target, Bot, Pickaxe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GameIcon } from "@/components/ui/game-icon";
import type { Character, AutomationStatus } from "@/lib/types";
import { SKILLS, SKILL_COLOR_TEXT_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CharacterCardProps {
  character: Character;
  automationStatus?: AutomationStatus;
}

function CooldownTimer({ expiration }: { expiration: string | null }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiration) {
      setRemaining(0);
      return;
    }

    function calculateRemaining() {
      const now = Date.now();
      const expiresAt = new Date(expiration!).getTime();
      const diff = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setRemaining(diff);
    }

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiration]);

  if (remaining <= 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400">
      <Clock className="size-3" />
      <span>{remaining}s</span>
    </div>
  );
}

const AUTOMATION_STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  running: { dot: "bg-green-500", text: "text-green-400" },
  paused: { dot: "bg-yellow-500", text: "text-yellow-400" },
  stopped: { dot: "bg-gray-500", text: "text-gray-400" },
  error: { dot: "bg-red-500", text: "text-red-400" },
};

const AUTOMATION_STRATEGY_ICONS: Record<string, React.ReactNode> = {
  combat: <Swords className="size-3 text-red-400" />,
  gathering: <Pickaxe className="size-3 text-green-400" />,
};

export function CharacterCard({ character, automationStatus }: CharacterCardProps) {
  const router = useRouter();
  const xpPercent =
    character.max_xp > 0
      ? Math.round((character.xp / character.max_xp) * 100)
      : 0;
  const hpPercent =
    character.max_hp > 0
      ? Math.round((character.hp / character.max_hp) * 100)
      : 0;

  const totalAttack =
    character.attack_fire +
    character.attack_earth +
    character.attack_water +
    character.attack_air;
  const totalDmg =
    character.dmg_fire +
    character.dmg_earth +
    character.dmg_water +
    character.dmg_air;

  // Get top 3 skills sorted by level
  const skillEntries = SKILLS.map((skill) => ({
    ...skill,
    level: character[`${skill.key}_level` as keyof Character] as number,
    xp: character[`${skill.key}_xp` as keyof Character] as number,
  }))
    .sort((a, b) => b.level - a.level)
    .slice(0, 3);

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/30 py-4"
      onClick={() => router.push(`/characters/${character.name}`)}
    >
      <CardHeader className="pb-0 pt-0 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GameIcon type="character" code={character.skin} size="md" showTooltip={false} />
            <CardTitle className="text-base">{character.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {automationStatus &&
              automationStatus.status !== "stopped" && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 gap-1",
                    AUTOMATION_STATUS_STYLES[automationStatus.status]?.text
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full inline-block",
                      AUTOMATION_STATUS_STYLES[automationStatus.status]?.dot,
                      automationStatus.status === "running" && "animate-pulse"
                    )}
                  />
                  {AUTOMATION_STRATEGY_ICONS[automationStatus.strategy_type] ?? (
                    <Bot className="size-3" />
                  )}
                  <span className="capitalize">
                    {automationStatus.strategy_type}
                  </span>
                </Badge>
              )}
            <Badge variant="secondary" className="text-xs">
              Lv. {character.level}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pt-2">
        {/* HP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>HP</span>
            <span>
              {character.hp}/{character.max_hp}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* XP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>XP</span>
            <span>{xpPercent}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Position + Gold row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            <span>
              ({character.x}, {character.y})
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <Coins className="size-3" />
            <span>{character.gold.toLocaleString()}</span>
          </div>
        </div>

        {/* Combat Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Swords className="size-3 text-red-400" />
            <span>ATK {totalAttack}</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="size-3 text-blue-400" />
            <span>DMG +{totalDmg}</span>
          </div>
        </div>

        {/* Top Skills */}
        <div className="flex flex-wrap gap-1.5">
          {skillEntries.map((skill) => (
            <Badge
              key={skill.key}
              variant="outline"
              className="text-[10px] px-1.5 py-0"
            >
              <span className={SKILL_COLOR_TEXT_MAP[skill.color]}>
                {skill.label}
              </span>
              <span className="ml-1 text-muted-foreground">
                {skill.level}
              </span>
            </Badge>
          ))}
        </div>

        {/* Cooldown */}
        <CooldownTimer expiration={character.cooldown_expiration} />

        {/* Task Progress */}
        {character.task && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="size-3" />
              <span className="truncate">
                {character.task_type}: {character.task}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={
                  character.task_total > 0
                    ? (character.task_progress / character.task_total) * 100
                    : 0
                }
                className="h-1.5 flex-1"
              />
              <span className="text-[10px] text-muted-foreground shrink-0">
                {character.task_progress}/{character.task_total}
              </span>
            </div>
          </div>
        )}

        {/* Equipment Summary */}
        {(character.weapon_slot || character.shield_slot) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {character.weapon_slot && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <GameIcon type="item" code={character.weapon_slot} size="sm" showTooltip={false} />
                {character.weapon_slot}
              </Badge>
            )}
            {character.shield_slot && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <GameIcon type="item" code={character.shield_slot} size="sm" showTooltip={false} />
                {character.shield_slot}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

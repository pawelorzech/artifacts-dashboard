"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SKILLS, SKILL_COLOR_MAP, SKILL_COLOR_TEXT_MAP } from "@/lib/constants";
import type { Character } from "@/lib/types";

interface SkillBarsProps {
  character: Character;
}

export function SkillBars({ character }: SkillBarsProps) {
  const skillData = SKILLS.map((skill) => ({
    ...skill,
    level: character[`${skill.key}_level` as keyof Character] as number,
    xp: character[`${skill.key}_xp` as keyof Character] as number,
    maxXp: (character[`${skill.key}_max_xp` as keyof Character] as number) || 0,
  })).sort((a, b) => b.level - a.level);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {skillData.map((skill) => (
          <div key={skill.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-medium ${SKILL_COLOR_TEXT_MAP[skill.color]}`}
              >
                {skill.label}
              </span>
              <Badge variant="secondary" className="text-xs">
                Lv. {skill.level}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted flex-1">
                <div
                  className={`h-full rounded-full ${SKILL_COLOR_MAP[skill.color]} opacity-80 transition-all`}
                  style={{
                    width: `${Math.min(100, skill.maxXp > 0 ? Math.max(2, (skill.xp / skill.maxXp) * 100) : 0)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-24 text-right shrink-0">
                {skill.xp.toLocaleString()}{skill.maxXp > 0 ? ` / ${skill.maxXp.toLocaleString()}` : ""} XP
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TYPE_PATHS: Record<string, string> = {
  item: "items",
  monster: "monsters",
  resource: "resources",
  character: "characters",
  effect: "effects",
  npc: "npcs",
  badge: "badges",
};

const SIZES = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
} as const;

type GameIconType = keyof typeof TYPE_PATHS;
type GameIconSize = keyof typeof SIZES;

interface GameIconProps {
  type: GameIconType;
  code: string;
  size?: GameIconSize;
  className?: string;
  showTooltip?: boolean;
}

function FallbackIcon({ code, px, className }: { code: string; px: number; className?: string }) {
  const hue = [...code].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-sm font-bold text-white select-none shrink-0",
        className
      )}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(px * 0.4, 8),
        backgroundColor: `hsl(${hue}, 50%, 35%)`,
      }}
    >
      {code.charAt(0).toUpperCase()}
    </div>
  );
}

export function GameIcon({
  type,
  code,
  size = "md",
  className,
  showTooltip = true,
}: GameIconProps) {
  const [errored, setErrored] = useState(false);
  const px = SIZES[size];
  const path = TYPE_PATHS[type] ?? "items";
  const src = `https://artifactsmmo.com/images/${path}/${code}.png`;

  const displayName = code.replaceAll("_", " ");

  const icon = errored ? (
    <FallbackIcon code={code} px={px} className={className} />
  ) : (
    <Image
      src={src}
      alt={displayName}
      width={px}
      height={px}
      className={cn("shrink-0 object-contain", className)}
      onError={() => setErrored(true)}
    />
  );

  if (!showTooltip) return icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">{icon}</span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="capitalize">{displayName}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

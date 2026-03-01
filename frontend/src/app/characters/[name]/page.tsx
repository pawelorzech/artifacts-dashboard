"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Move,
  Swords,
  Pickaxe,
  BedDouble,
} from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { StatsPanel } from "@/components/character/stats-panel";
import { EquipmentGrid } from "@/components/character/equipment-grid";
import { InventoryGrid } from "@/components/character/inventory-grid";
import { SkillBars } from "@/components/character/skill-bars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { executeAction } from "@/lib/api-client";
import { toast } from "sonner";

export default function CharacterPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const decodedName = decodeURIComponent(name);
  const { data: character, isLoading, error } = useCharacter(decodedName);

  const [moveX, setMoveX] = useState("");
  const [moveY, setMoveY] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);

  async function handleAction(
    action: string,
    params: Record<string, unknown> = {}
  ) {
    setActionPending(action);
    try {
      await executeAction(decodedName, action, params);
      toast.success(`Action "${action}" executed successfully`);
    } catch (err) {
      toast.error(
        `Action "${action}" failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setActionPending(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Character</h1>
        </div>
        <Card className="border-destructive bg-destructive/10 p-6">
          <p className="text-sm text-destructive">
            Failed to load character &quot;{decodedName}&quot;. Make sure the
            backend is running and the character exists.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {character.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Level {character.level} &middot; {character.skin}
          </p>
        </div>
      </div>

      {/* Top row: Stats + Equipment */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatsPanel character={character} />
        <EquipmentGrid character={character} />
      </div>

      {/* Bottom row: Inventory + Skills */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryGrid character={character} />
        <SkillBars character={character} />
      </div>

      {/* Manual Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manual Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Move action with x,y inputs */}
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="move-x" className="text-xs">
                  X
                </Label>
                <Input
                  id="move-x"
                  type="number"
                  value={moveX}
                  onChange={(e) => setMoveX(e.target.value)}
                  placeholder={String(character.x)}
                  className="w-20 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="move-y" className="text-xs">
                  Y
                </Label>
                <Input
                  id="move-y"
                  type="number"
                  value={moveY}
                  onChange={(e) => setMoveY(e.target.value)}
                  placeholder={String(character.y)}
                  className="w-20 h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={actionPending !== null}
                onClick={() =>
                  handleAction("move", {
                    x: parseInt(moveX, 10) || character.x,
                    y: parseInt(moveY, 10) || character.y,
                  })
                }
              >
                {actionPending === "move" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Move className="size-4" />
                )}
                Move
              </Button>
            </div>

            {/* Fight */}
            <Button
              variant="outline"
              size="sm"
              disabled={actionPending !== null}
              onClick={() => handleAction("fight")}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              {actionPending === "fight" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Swords className="size-4" />
              )}
              Fight
            </Button>

            {/* Gather */}
            <Button
              variant="outline"
              size="sm"
              disabled={actionPending !== null}
              onClick={() => handleAction("gather")}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
            >
              {actionPending === "gather" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Pickaxe className="size-4" />
              )}
              Gather
            </Button>

            {/* Rest */}
            <Button
              variant="outline"
              size="sm"
              disabled={actionPending !== null}
              onClick={() => handleAction("rest")}
              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
            >
              {actionPending === "rest" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BedDouble className="size-4" />
              )}
              Rest
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

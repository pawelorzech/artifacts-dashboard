"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EQUIPMENT_SLOTS } from "@/lib/constants";
import type { Character } from "@/lib/types";
import { GameIcon } from "@/components/ui/game-icon";
import { cn } from "@/lib/utils";
import { executeAction } from "@/lib/api-client";
import { toast } from "sonner";

interface EquipmentGridProps {
  character: Character;
  onActionComplete?: () => void;
}

export function EquipmentGrid({ character, onActionComplete }: EquipmentGridProps) {
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  async function handleUnequip(slotKey: string) {
    const slot = slotKey.replace("_slot", "");
    setPendingSlot(slotKey);
    try {
      await executeAction(character.name, "unequip", { slot });
      toast.success(`Unequipped ${slot}`);
      onActionComplete?.();
    } catch (err) {
      toast.error(
        `Unequip failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setPendingSlot(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Equipment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_SLOTS.map((slot) => {
            const itemCode = character[slot.key as keyof Character] as string;
            const isEmpty = !itemCode;
            const isPending = pendingSlot === slot.key;

            let quantity: number | null = null;
            if (slot.key === "utility1_slot" && itemCode) {
              quantity = character.utility1_slot_quantity;
            } else if (slot.key === "utility2_slot" && itemCode) {
              quantity = character.utility2_slot_quantity;
            }

            return (
              <div
                key={slot.key}
                className={cn(
                  "group relative flex flex-col gap-1 rounded-lg border p-2.5 transition-colors",
                  isEmpty
                    ? "border-dashed border-border/50 bg-transparent"
                    : "border-border bg-accent/30 hover:bg-accent/50"
                )}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {slot.label}
                </span>
                {isEmpty ? (
                  <span className="text-xs text-muted-foreground/50">
                    Empty
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <GameIcon type="item" code={itemCode} size="md" />
                    <span className="text-xs font-medium text-foreground truncate">
                      {itemCode}
                    </span>
                    {quantity !== null && quantity > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1 py-0 shrink-0"
                      >
                        x{quantity}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Unequip button - shown on hover */}
                {!isEmpty && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                          disabled={isPending}
                          onClick={() => handleUnequip(slot.key)}
                        >
                          {isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <X className="size-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Unequip {slot.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

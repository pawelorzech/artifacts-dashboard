"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EQUIPMENT_SLOTS } from "@/lib/constants";
import type { Character } from "@/lib/types";
import { GameIcon } from "@/components/ui/game-icon";
import { cn } from "@/lib/utils";

interface EquipmentGridProps {
  character: Character;
}

export function EquipmentGrid({ character }: EquipmentGridProps) {
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

            // Show quantity for utility slots
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
                  "flex flex-col gap-1 rounded-lg border p-2.5 transition-colors",
                  isEmpty
                    ? "border-dashed border-border/50 bg-transparent"
                    : "border-border bg-accent/30"
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
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Character } from "@/lib/types";

interface InventoryGridProps {
  character: Character;
}

export function InventoryGrid({ character }: InventoryGridProps) {
  const usedSlots = character.inventory.filter(
    (slot) => slot.code && slot.code !== ""
  ).length;
  const totalSlots = character.inventory_max_items;

  // Build a map from slot number to inventory item
  const slotMap = new Map(
    character.inventory
      .filter((slot) => slot.code && slot.code !== "")
      .map((slot) => [slot.slot, slot])
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Inventory</CardTitle>
          <Badge variant="outline" className="text-xs">
            {usedSlots}/{totalSlots}
          </Badge>
        </div>
        <CardDescription>
          {totalSlots - usedSlots} slots available
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
          {Array.from({ length: totalSlots }).map((_, index) => {
            const item = slotMap.get(index + 1);
            const isEmpty = !item;

            return (
              <div
                key={index}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md border p-1.5 aspect-square min-h-[48px]",
                  isEmpty
                    ? "border-dashed border-border/40"
                    : "border-border bg-accent/30"
                )}
              >
                {item && (
                  <>
                    <span className="text-[9px] font-medium text-foreground text-center leading-tight truncate w-full">
                      {item.code}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-[9px] text-muted-foreground">
                        x{item.quantity}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

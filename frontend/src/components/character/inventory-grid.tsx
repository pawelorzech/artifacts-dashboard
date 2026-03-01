"use client";

import { useState } from "react";
import {
  Shield,
  FlaskConical,
  Landmark,
  Recycle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/ui/game-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EQUIPMENT_SLOTS } from "@/lib/constants";
import type { Character, InventorySlot } from "@/lib/types";
import { executeAction } from "@/lib/api-client";
import { toast } from "sonner";

interface InventoryGridProps {
  character: Character;
  onActionComplete?: () => void;
}

export function InventoryGrid({ character, onActionComplete }: InventoryGridProps) {
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);

  const filledItems = character.inventory.filter(
    (slot) => slot.code && slot.code !== ""
  );
  const usedSlots = filledItems.length;
  const totalSlots = character.inventory_max_items;
  const emptySlots = totalSlots - usedSlots;

  async function handleAction(
    slotNum: number,
    action: string,
    params: Record<string, unknown>
  ) {
    setPendingSlot(slotNum);
    try {
      await executeAction(character.name, action, params);
      toast.success(`${action} successful`);
      onActionComplete?.();
    } catch (err) {
      toast.error(
        `${action} failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setPendingSlot(null);
    }
  }

  const equipSlots = EQUIPMENT_SLOTS.map((s) => ({
    key: s.key.replace("_slot", ""),
    label: s.label,
  }));

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
          {emptySlots} slots available
          {usedSlots > 0 && " \u00b7 Click items for actions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {usedSlots === 0 ? (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
            <Package className="size-4" />
            Inventory is empty
          </div>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
            {filledItems.map((item) => (
              <InventoryItemSlot
                key={item.slot}
                item={item}
                isPending={pendingSlot === item.slot}
                equipSlots={equipSlots}
                characterName={character.name}
                onAction={(action, params) =>
                  handleAction(item.slot, action, params)
                }
              />
            ))}
          </div>
        )}

        {/* Expandable full grid with all slots */}
        {emptySlots > 0 && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground h-7"
              onClick={() => setShowAllSlots(!showAllSlots)}
            >
              {showAllSlots ? (
                <>
                  <ChevronUp className="size-3 mr-1" />
                  Hide empty slots
                </>
              ) : (
                <>
                  <ChevronDown className="size-3 mr-1" />
                  Show all {totalSlots} slots ({emptySlots} empty)
                </>
              )}
            </Button>

            {showAllSlots && (
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 gap-1 mt-2">
                {Array.from({ length: totalSlots }).map((_, index) => {
                  const slotNum = index + 1;
                  const item = filledItems.find((i) => i.slot === slotNum);

                  if (!item) {
                    return (
                      <div
                        key={index}
                        className="rounded border border-dashed border-border/30 aspect-square min-h-[32px]"
                      />
                    );
                  }

                  return (
                    <InventoryItemSlot
                      key={index}
                      item={item}
                      isPending={pendingSlot === slotNum}
                      equipSlots={equipSlots}
                      characterName={character.name}
                      onAction={(action, params) =>
                        handleAction(item.slot, action, params)
                      }
                      compact
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryItemSlot({
  item,
  isPending,
  equipSlots,
  onAction,
  compact,
}: {
  item: InventorySlot;
  isPending: boolean;
  equipSlots: { key: string; label: string }[];
  characterName: string;
  onAction: (action: string, params: Record<string, unknown>) => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-center justify-center rounded-md border transition-colors cursor-pointer",
            "border-border bg-accent/30 hover:bg-accent/60 hover:border-primary/40",
            isPending && "opacity-50 pointer-events-none",
            compact
              ? "p-0.5 aspect-square min-h-[32px]"
              : "p-1.5 aspect-square min-h-[48px]"
          )}
        >
          {isPending ? (
            <Loader2
              className={cn(
                "animate-spin text-muted-foreground",
                compact ? "size-3" : "size-5"
              )}
            />
          ) : (
            <div className="relative flex items-center justify-center">
              <GameIcon
                type="item"
                code={item.code}
                size={compact ? "sm" : "md"}
              />
              {item.quantity > 1 && (
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 rounded bg-background/80 font-medium text-muted-foreground leading-tight",
                    compact ? "px-0.5 text-[7px]" : "px-0.5 text-[9px]"
                  )}
                >
                  {item.quantity}
                </span>
              )}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2">
          <GameIcon type="item" code={item.code} size="sm" />
          {item.code}
          {item.quantity > 1 && (
            <span className="text-muted-foreground font-normal">
              x{item.quantity}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Equip - submenu with slot selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Shield className="size-4 text-blue-400" />
            Equip
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {equipSlots.map((slot) => (
              <DropdownMenuItem
                key={slot.key}
                onClick={() =>
                  onAction("equip", { code: item.code, slot: slot.key })
                }
              >
                {slot.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Use item */}
        <DropdownMenuItem
          onClick={() => onAction("use_item", { code: item.code, quantity: 1 })}
        >
          <FlaskConical className="size-4 text-green-400" />
          Use
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Deposit to bank */}
        <DropdownMenuItem
          onClick={() =>
            onAction("deposit", { code: item.code, quantity: item.quantity })
          }
        >
          <Landmark className="size-4 text-purple-400" />
          Deposit All ({item.quantity})
        </DropdownMenuItem>

        {item.quantity > 1 && (
          <DropdownMenuItem
            onClick={() =>
              onAction("deposit", { code: item.code, quantity: 1 })
            }
          >
            <Landmark className="size-4 text-purple-400" />
            Deposit 1
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Recycle */}
        <DropdownMenuItem
          onClick={() =>
            onAction("recycle", { code: item.code, quantity: 1 })
          }
        >
          <Recycle className="size-4 text-orange-400" />
          Recycle
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

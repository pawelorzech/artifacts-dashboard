"use client";

import { useState } from "react";
import { Loader2, ShoppingCart, Shield, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GameIcon } from "@/components/ui/game-icon";
import { EQUIPMENT_SLOTS } from "@/lib/constants";
import { executeAction } from "@/lib/api-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { GEOrder, Item } from "@/lib/types";

// Map item type → suggested equipment slot key (without _slot suffix)
const TYPE_TO_SLOT: Record<string, string> = {
  weapon: "weapon",
  shield: "shield",
  helmet: "helmet",
  body_armor: "body_armor",
  leg_armor: "leg_armor",
  boots: "boots",
  ring: "ring1",
  amulet: "amulet",
  artifact: "artifact1",
};

interface BuyEquipDialogProps {
  order: GEOrder | null;
  characterName: string;
  items?: Item[];
  onOpenChange: (open: boolean) => void;
}

type Step = "confirm" | "buying" | "bought" | "equipping" | "equipped";

export function BuyEquipDialog({
  order,
  characterName,
  items,
  onOpenChange,
}: BuyEquipDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("confirm");
  const [quantity, setQuantity] = useState("1");
  const [equipSlot, setEquipSlot] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!order) return null;

  const itemInfo = items?.find((i) => i.code === order.code);
  const isEquippable = itemInfo
    ? Object.keys(TYPE_TO_SLOT).includes(itemInfo.type)
    : false;

  const maxQty = order.quantity;
  const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, maxQty));
  const totalCost = qty * order.price;

  // Auto-suggest slot based on item type
  const suggestedSlot = itemInfo ? TYPE_TO_SLOT[itemInfo.type] ?? "" : "";

  function handleClose() {
    setStep("confirm");
    setQuantity("1");
    setEquipSlot("");
    setError(null);
    onOpenChange(false);
  }

  async function handleBuy() {
    setStep("buying");
    setError(null);
    try {
      await executeAction(characterName, "ge_buy", {
        id: order!.id,
        quantity: qty,
      });
      toast.success(`Bought ${qty}x ${order!.code}`);
      queryClient.invalidateQueries({ queryKey: ["exchange"] });
      queryClient.invalidateQueries({ queryKey: ["character", characterName] });
      setStep("bought");

      // Pre-select suggested slot
      if (suggestedSlot && !equipSlot) {
        setEquipSlot(suggestedSlot);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buy failed");
      setStep("confirm");
    }
  }

  async function handleEquip() {
    if (!equipSlot) {
      toast.error("Select an equipment slot");
      return;
    }
    setStep("equipping");
    setError(null);
    try {
      await executeAction(characterName, "equip", {
        code: order!.code,
        slot: equipSlot,
      });
      toast.success(`Equipped ${order!.code} to ${equipSlot}`);
      queryClient.invalidateQueries({ queryKey: ["character", characterName] });
      setStep("equipped");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Equip failed");
      setStep("bought");
    }
  }

  const equipSlots = EQUIPMENT_SLOTS.map((s) => ({
    key: s.key.replace("_slot", ""),
    label: s.label,
  }));

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GameIcon type="item" code={order.code} size="md" showTooltip={false} />
            {step === "equipped" ? "Equipped!" : step === "bought" ? "Purchased!" : `Buy ${order.code}`}
          </DialogTitle>
          <DialogDescription>
            {step === "confirm" && "Place a buy order to match this sell listing."}
            {step === "buying" && "Placing buy order..."}
            {step === "bought" && (isEquippable
              ? "Item purchased! You can now equip it."
              : "Item purchased successfully!")}
            {step === "equipping" && "Equipping item..."}
            {step === "equipped" && "Item equipped successfully!"}
          </DialogDescription>
        </DialogHeader>

        {/* Item details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Price each</span>
            <span className="text-amber-400 font-medium tabular-nums">
              {order.price.toLocaleString()} gold
            </span>
          </div>

          {itemInfo && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className="text-xs">
                {itemInfo.type}{itemInfo.subtype ? ` / ${itemInfo.subtype}` : ""}
              </Badge>
            </div>
          )}

          {itemInfo && itemInfo.level > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Required level</span>
              <span className="tabular-nums">{itemInfo.level}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Seller</span>
            <span className="text-xs">{order.account ?? "Unknown"}</span>
          </div>

          {/* Confirm step: quantity selector */}
          {step === "confirm" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity (max {maxQty})</Label>
                <Input
                  type="number"
                  min="1"
                  max={maxQty}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Total cost</span>
                <span className="text-amber-400 tabular-nums">
                  {totalCost.toLocaleString()} gold
                </span>
              </div>
            </>
          )}

          {/* Bought step: equip slot selector */}
          {step === "bought" && isEquippable && (
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs">Equip to slot</Label>
              <Select value={equipSlot} onValueChange={setEquipSlot}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select slot..." />
                </SelectTrigger>
                <SelectContent>
                  {equipSlots.map((slot) => (
                    <SelectItem key={slot.key} value={slot.key}>
                      {slot.label}
                      {slot.key === suggestedSlot && " (suggested)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Success states */}
          {step === "equipped" && (
            <div className="flex items-center gap-2 text-green-400 pt-2 border-t">
              <CheckCircle2 className="size-4" />
              <span className="text-sm">
                {order.code} equipped to {equipSlots.find((s) => s.key === equipSlot)?.label ?? equipSlot}
              </span>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!characterName || qty < 1}
                onClick={handleBuy}
              >
                <ShoppingCart className="size-4" />
                Buy {qty}x for {totalCost.toLocaleString()}g
              </Button>
            </>
          )}

          {step === "buying" && (
            <Button disabled>
              <Loader2 className="size-4 animate-spin" />
              Buying...
            </Button>
          )}

          {step === "bought" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
              {isEquippable && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!equipSlot}
                  onClick={handleEquip}
                >
                  <Shield className="size-4" />
                  Equip
                </Button>
              )}
            </>
          )}

          {step === "equipping" && (
            <Button disabled>
              <Loader2 className="size-4 animate-spin" />
              Equipping...
            </Button>
          )}

          {step === "equipped" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

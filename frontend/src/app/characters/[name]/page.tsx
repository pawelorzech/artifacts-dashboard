"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Move,
  Swords,
  Pickaxe,
  BedDouble,
  Landmark,
  Coins,
  Hammer,
  Recycle,
  ShoppingCart,
  ScrollText,
  Store,
} from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { StatsPanel } from "@/components/character/stats-panel";
import { EquipmentGrid } from "@/components/character/equipment-grid";
import { InventoryGrid } from "@/components/character/inventory-grid";
import { SkillBars } from "@/components/character/skill-bars";
import { CharacterAutomations } from "@/components/character/character-automations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { executeAction } from "@/lib/api-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function CharacterPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const decodedName = decodeURIComponent(name);
  const { data: character, isLoading, error } = useCharacter(decodedName);
  const queryClient = useQueryClient();

  const [actionPending, setActionPending] = useState<string | null>(null);

  const refreshCharacter = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["character", decodedName] });
  }, [queryClient, decodedName]);

  async function handleAction(
    action: string,
    params: Record<string, unknown> = {}
  ) {
    setActionPending(action);
    try {
      const result = await executeAction(decodedName, action, params);
      toast.success(`${action} executed successfully`);
      refreshCharacter();
      return result;
    } catch (err) {
      toast.error(
        `${action} failed: ${err instanceof Error ? err.message : "Unknown error"}`
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
    <div className="space-y-4">
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
            Level {character.level} &middot; {character.skin} &middot;
            Position ({character.x}, {character.y})
            {character.gold > 0 && (
              <> &middot; <span className="text-amber-400">{character.gold.toLocaleString()} gold</span></>
            )}
          </p>
        </div>
      </div>

      {/* Stats, Equipment, Skills - 3 columns on xl, 2 on md */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatsPanel character={character} />
        <EquipmentGrid character={character} onActionComplete={refreshCharacter} />
        <SkillBars character={character} />
      </div>

      {/* Inventory - full width, compact by default */}
      <InventoryGrid character={character} onActionComplete={refreshCharacter} />

      {/* Automations */}
      <CharacterAutomations characterName={decodedName} character={character} />

      {/* Manual Actions Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Manual Actions</CardTitle>
            {character.cooldown > 0 && character.cooldown_expiration && (
              <CooldownBadge expiration={character.cooldown_expiration} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
              <TabsTrigger value="basic" className="gap-1 text-xs">
                <Swords className="size-3" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-1 text-xs">
                <Landmark className="size-3" />
                Bank
              </TabsTrigger>
              <TabsTrigger value="craft" className="gap-1 text-xs">
                <Hammer className="size-3" />
                Craft
              </TabsTrigger>
              <TabsTrigger value="exchange" className="gap-1 text-xs">
                <ShoppingCart className="size-3" />
                Exchange
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1 text-xs">
                <ScrollText className="size-3" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="npc" className="gap-1 text-xs">
                <Store className="size-3" />
                NPC
              </TabsTrigger>
            </TabsList>

            {/* Basic Actions */}
            <TabsContent value="basic">
              <BasicActions
                character={character}
                actionPending={actionPending}
                onAction={handleAction}
              />
            </TabsContent>

            {/* Bank Actions */}
            <TabsContent value="bank">
              <BankActions
                actionPending={actionPending}
                onAction={handleAction}
              />
            </TabsContent>

            {/* Crafting Actions */}
            <TabsContent value="craft">
              <CraftActions
                actionPending={actionPending}
                onAction={handleAction}
              />
            </TabsContent>

            {/* GE Actions */}
            <TabsContent value="exchange">
              <ExchangeActions
                actionPending={actionPending}
                onAction={handleAction}
              />
            </TabsContent>

            {/* Task Actions */}
            <TabsContent value="tasks">
              <TaskActions
                character={character}
                actionPending={actionPending}
                onAction={handleAction}
              />
            </TabsContent>

            {/* NPC Actions */}
            <TabsContent value="npc">
              <NpcActions
                actionPending={actionPending}
                onAction={handleAction}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cooldown badge
// ---------------------------------------------------------------------------

function CooldownBadge({ expiration }: { expiration: string }) {
  const [, setTick] = useState(0);
  const expiresAt = new Date(expiration).getTime();
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  // Auto-refresh every second while cooldown is active
  if (remaining > 0) {
    setTimeout(() => setTick((t) => t + 1), 1000);
  }

  if (remaining <= 0) return null;

  return (
    <Badge variant="secondary" className="text-xs tabular-nums">
      Cooldown: {remaining}s
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Action button helper
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  icon: Icon,
  action,
  actionPending,
  onClick,
  className,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  actionPending: string | null;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const isPending = actionPending === action;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={actionPending !== null || disabled}
      onClick={onClick}
      className={className}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Icon className="size-4" />
      )}
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Basic Actions: Move, Fight, Gather, Rest
// ---------------------------------------------------------------------------

function BasicActions({
  character,
  actionPending,
  onAction,
}: {
  character: { x: number; y: number };
  actionPending: string | null;
  onAction: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [moveX, setMoveX] = useState("");
  const [moveY, setMoveY] = useState("");

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="move-x" className="text-xs">X</Label>
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
          <Label htmlFor="move-y" className="text-xs">Y</Label>
          <Input
            id="move-y"
            type="number"
            value={moveY}
            onChange={(e) => setMoveY(e.target.value)}
            placeholder={String(character.y)}
            className="w-20 h-9"
          />
        </div>
        <ActionButton
          label="Move"
          icon={Move}
          action="move"
          actionPending={actionPending}
          onClick={() =>
            onAction("move", {
              x: parseInt(moveX, 10) || character.x,
              y: parseInt(moveY, 10) || character.y,
            })
          }
        />
      </div>

      <ActionButton
        label="Fight"
        icon={Swords}
        action="fight"
        actionPending={actionPending}
        onClick={() => onAction("fight")}
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
      />

      <ActionButton
        label="Gather"
        icon={Pickaxe}
        action="gather"
        actionPending={actionPending}
        onClick={() => onAction("gather")}
        className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
      />

      <ActionButton
        label="Rest"
        icon={BedDouble}
        action="rest"
        actionPending={actionPending}
        onClick={() => onAction("rest")}
        className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bank Actions: Deposit/Withdraw items and gold
// ---------------------------------------------------------------------------

function BankActions({
  actionPending,
  onAction,
}: {
  actionPending: string | null;
  onAction: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [depositCode, setDepositCode] = useState("");
  const [depositQty, setDepositQty] = useState("1");
  const [withdrawCode, setWithdrawCode] = useState("");
  const [withdrawQty, setWithdrawQty] = useState("1");
  const [goldAmount, setGoldAmount] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Character must be at a bank tile to deposit/withdraw. You can also click inventory items to deposit them directly.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Deposit item */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Deposit Item</p>
          <div className="flex gap-2">
            <Input
              placeholder="Item code"
              value={depositCode}
              onChange={(e) => setDepositCode(e.target.value)}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="1"
              value={depositQty}
              onChange={(e) => setDepositQty(e.target.value)}
              className="h-9 w-20"
            />
          </div>
          <ActionButton
            label="Deposit"
            icon={Landmark}
            action="deposit"
            actionPending={actionPending}
            onClick={() =>
              onAction("deposit", {
                code: depositCode,
                quantity: parseInt(depositQty, 10) || 1,
              })
            }
            disabled={!depositCode.trim()}
            className="w-full text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
          />
        </div>

        {/* Withdraw item */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Withdraw Item</p>
          <div className="flex gap-2">
            <Input
              placeholder="Item code"
              value={withdrawCode}
              onChange={(e) => setWithdrawCode(e.target.value)}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="1"
              value={withdrawQty}
              onChange={(e) => setWithdrawQty(e.target.value)}
              className="h-9 w-20"
            />
          </div>
          <ActionButton
            label="Withdraw"
            icon={Landmark}
            action="withdraw"
            actionPending={actionPending}
            onClick={() =>
              onAction("withdraw", {
                code: withdrawCode,
                quantity: parseInt(withdrawQty, 10) || 1,
              })
            }
            disabled={!withdrawCode.trim()}
            className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          />
        </div>
      </div>

      {/* Gold operations */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Gold</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              min="1"
              placeholder="Gold amount"
              value={goldAmount}
              onChange={(e) => setGoldAmount(e.target.value)}
              className="h-9"
            />
          </div>
          <ActionButton
            label="Deposit Gold"
            icon={Coins}
            action="deposit_gold"
            actionPending={actionPending}
            onClick={() =>
              onAction("deposit_gold", {
                quantity: parseInt(goldAmount, 10) || 0,
              })
            }
            disabled={!goldAmount || parseInt(goldAmount, 10) <= 0}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          />
          <ActionButton
            label="Withdraw Gold"
            icon={Coins}
            action="withdraw_gold"
            actionPending={actionPending}
            onClick={() =>
              onAction("withdraw_gold", {
                quantity: parseInt(goldAmount, 10) || 0,
              })
            }
            disabled={!goldAmount || parseInt(goldAmount, 10) <= 0}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Craft/Recycle Actions
// ---------------------------------------------------------------------------

function CraftActions({
  actionPending,
  onAction,
}: {
  actionPending: string | null;
  onAction: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [craftCode, setCraftCode] = useState("");
  const [craftQty, setCraftQty] = useState("1");
  const [recycleCode, setRecycleCode] = useState("");
  const [recycleQty, setRecycleQty] = useState("1");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Character must be at the correct workshop tile to craft or recycle.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Craft */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Craft Item</p>
          <div className="flex gap-2">
            <Input
              placeholder="Item code"
              value={craftCode}
              onChange={(e) => setCraftCode(e.target.value)}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="1"
              value={craftQty}
              onChange={(e) => setCraftQty(e.target.value)}
              className="h-9 w-20"
              placeholder="Qty"
            />
          </div>
          <ActionButton
            label="Craft"
            icon={Hammer}
            action="craft"
            actionPending={actionPending}
            onClick={() =>
              onAction("craft", {
                code: craftCode,
                quantity: parseInt(craftQty, 10) || 1,
              })
            }
            disabled={!craftCode.trim()}
            className="w-full text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
          />
        </div>

        {/* Recycle */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Recycle Item</p>
          <div className="flex gap-2">
            <Input
              placeholder="Item code"
              value={recycleCode}
              onChange={(e) => setRecycleCode(e.target.value)}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="1"
              value={recycleQty}
              onChange={(e) => setRecycleQty(e.target.value)}
              className="h-9 w-20"
              placeholder="Qty"
            />
          </div>
          <ActionButton
            label="Recycle"
            icon={Recycle}
            action="recycle"
            actionPending={actionPending}
            onClick={() =>
              onAction("recycle", {
                code: recycleCode,
                quantity: parseInt(recycleQty, 10) || 1,
              })
            }
            disabled={!recycleCode.trim()}
            className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exchange (GE) Actions: Buy, Sell, Cancel
// ---------------------------------------------------------------------------

function ExchangeActions({
  actionPending,
  onAction,
}: {
  actionPending: string | null;
  onAction: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [buyCode, setBuyCode] = useState("");
  const [buyQty, setBuyQty] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellCode, setSellCode] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [cancelId, setCancelId] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Character must be at the Grand Exchange tile. Create buy/sell orders or cancel existing ones.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Buy order */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium text-green-400">Create Buy Order</p>
          <Input
            placeholder="Item code"
            value={buyCode}
            onChange={(e) => setBuyCode(e.target.value)}
            className="h-9"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              placeholder="Qty"
              value={buyQty}
              onChange={(e) => setBuyQty(e.target.value)}
              className="h-9"
            />
            <Input
              type="number"
              min="1"
              placeholder="Price each"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              className="h-9"
            />
          </div>
          {buyCode && buyPrice && (
            <p className="text-xs text-muted-foreground">
              Total: {((parseInt(buyQty, 10) || 1) * (parseInt(buyPrice, 10) || 0)).toLocaleString()} gold
            </p>
          )}
          <ActionButton
            label="Create Buy Order"
            icon={ShoppingCart}
            action="ge_create_buy"
            actionPending={actionPending}
            onClick={() =>
              onAction("ge_create_buy", {
                code: buyCode,
                quantity: parseInt(buyQty, 10) || 1,
                price: parseInt(buyPrice, 10) || 0,
              })
            }
            disabled={!buyCode.trim() || !buyPrice}
            className="w-full text-green-400 hover:text-green-300 hover:bg-green-500/10"
          />
        </div>

        {/* Sell order */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium text-red-400">Create Sell Order</p>
          <Input
            placeholder="Item code"
            value={sellCode}
            onChange={(e) => setSellCode(e.target.value)}
            className="h-9"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              placeholder="Qty"
              value={sellQty}
              onChange={(e) => setSellQty(e.target.value)}
              className="h-9"
            />
            <Input
              type="number"
              min="1"
              placeholder="Price each"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              className="h-9"
            />
          </div>
          {sellCode && sellPrice && (
            <p className="text-xs text-muted-foreground">
              Total: {((parseInt(sellQty, 10) || 1) * (parseInt(sellPrice, 10) || 0)).toLocaleString()} gold
            </p>
          )}
          <ActionButton
            label="Sell"
            icon={ShoppingCart}
            action="ge_sell"
            actionPending={actionPending}
            onClick={() =>
              onAction("ge_sell", {
                code: sellCode,
                quantity: parseInt(sellQty, 10) || 1,
                price: parseInt(sellPrice, 10) || 0,
              })
            }
            disabled={!sellCode.trim() || !sellPrice}
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          />
        </div>
      </div>

      {/* Cancel order */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Cancel Order</p>
        <div className="flex gap-2">
          <Input
            placeholder="Order ID"
            value={cancelId}
            onChange={(e) => setCancelId(e.target.value)}
            className="h-9 flex-1"
          />
          <ActionButton
            label="Cancel Order"
            icon={ShoppingCart}
            action="ge_cancel"
            actionPending={actionPending}
            onClick={() => onAction("ge_cancel", { order_id: cancelId })}
            disabled={!cancelId.trim()}
            className="text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Actions: New, Trade, Complete, Exchange, Cancel
// ---------------------------------------------------------------------------

function TaskActions({
  character,
  actionPending,
  onAction,
}: {
  character: { task: string; task_type: string; task_progress: number; task_total: number };
  actionPending: string | null;
  onAction: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [tradeCode, setTradeCode] = useState("");
  const [tradeQty, setTradeQty] = useState("1");

  const hasTask = character.task && character.task !== "";

  return (
    <div className="space-y-4">
      {/* Current task info */}
      {hasTask && (
        <div className="rounded-lg border p-3 bg-accent/30">
          <p className="text-sm font-medium">Current Task</p>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-foreground">{character.task}</span>
            {" "}({character.task_type})
            {" "}&middot; Progress: {character.task_progress}/{character.task_total}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Character must be at a task master tile. Accept tasks, trade items, complete tasks, or exchange task coins.
      </p>

      <div className="flex flex-wrap gap-3">
        <ActionButton
          label="Accept New Task"
          icon={ScrollText}
          action="task_new"
          actionPending={actionPending}
          onClick={() => onAction("task_new")}
          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
        />

        <ActionButton
          label="Complete Task"
          icon={ScrollText}
          action="task_complete"
          actionPending={actionPending}
          onClick={() => onAction("task_complete")}
          disabled={!hasTask}
          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
        />

        <ActionButton
          label="Exchange Coins"
          icon={Coins}
          action="task_exchange"
          actionPending={actionPending}
          onClick={() => onAction("task_exchange")}
          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
        />

        <ActionButton
          label="Cancel Task"
          icon={ScrollText}
          action="task_cancel"
          actionPending={actionPending}
          onClick={() => onAction("task_cancel")}
          disabled={!hasTask}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        />
      </div>

      {/* Trade items to task master */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Trade Items to Task Master</p>
        <div className="flex gap-2 items-end">
          <Input
            placeholder="Item code"
            value={tradeCode}
            onChange={(e) => setTradeCode(e.target.value)}
            className="h-9 flex-1"
          />
          <Input
            type="number"
            min="1"
            value={tradeQty}
            onChange={(e) => setTradeQty(e.target.value)}
            className="h-9 w-20"
            placeholder="Qty"
          />
          <ActionButton
            label="Trade"
            icon={ScrollText}
            action="task_trade"
            actionPending={actionPending}
            onClick={() =>
              onAction("task_trade", {
                code: tradeCode,
                quantity: parseInt(tradeQty, 10) || 1,
              })
            }
            disabled={!tradeCode.trim()}
            className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NPC Actions: Buy/Sell
// ---------------------------------------------------------------------------

function NpcActions({
  actionPending,
  onAction,
}: {
  actionPending: string | null;
  onAction: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [buyCode, setBuyCode] = useState("");
  const [buyQty, setBuyQty] = useState("1");
  const [sellCode, setSellCode] = useState("");
  const [sellQty, setSellQty] = useState("1");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Character must be at an NPC shop tile to buy or sell items.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* NPC Buy */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium text-green-400">Buy from NPC</p>
          <div className="flex gap-2">
            <Input
              placeholder="Item code"
              value={buyCode}
              onChange={(e) => setBuyCode(e.target.value)}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="1"
              value={buyQty}
              onChange={(e) => setBuyQty(e.target.value)}
              className="h-9 w-20"
              placeholder="Qty"
            />
          </div>
          <ActionButton
            label="Buy"
            icon={Store}
            action="npc_buy"
            actionPending={actionPending}
            onClick={() =>
              onAction("npc_buy", {
                code: buyCode,
                quantity: parseInt(buyQty, 10) || 1,
              })
            }
            disabled={!buyCode.trim()}
            className="w-full text-green-400 hover:text-green-300 hover:bg-green-500/10"
          />
        </div>

        {/* NPC Sell */}
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium text-red-400">Sell to NPC</p>
          <div className="flex gap-2">
            <Input
              placeholder="Item code"
              value={sellCode}
              onChange={(e) => setSellCode(e.target.value)}
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="1"
              value={sellQty}
              onChange={(e) => setSellQty(e.target.value)}
              className="h-9 w-20"
              placeholder="Qty"
            />
          </div>
          <ActionButton
            label="Sell"
            icon={Store}
            action="npc_sell"
            actionPending={actionPending}
            onClick={() =>
              onAction("npc_sell", {
                code: sellCode,
                quantity: parseInt(sellQty, 10) || 1,
              })
            }
            disabled={!sellCode.trim()}
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Loader2,
  Search,
  ShoppingCart,
  History,
  TrendingUp,
  User,
  Plus,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useExchangeOrders,
  useMyOrders,
  useExchangeHistory,
  usePriceHistory,
} from "@/hooks/use-exchange";
import { useCharacters } from "@/hooks/use-characters";
import { useItems } from "@/hooks/use-game-data";
import { PriceChart } from "@/components/exchange/price-chart";
import { BuyEquipDialog } from "@/components/exchange/buy-equip-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import { executeAction } from "@/lib/api-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { GEOrder, GEHistoryEntry } from "@/lib/types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrdersTable({
  orders,
  isLoading,
  search,
  emptyMessage,
  showAccount,
  onBuy,
}: {
  orders: GEOrder[];
  isLoading: boolean;
  search: string;
  emptyMessage: string;
  showAccount?: boolean;
  onBuy?: (order: GEOrder) => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase().trim();
    return orders.filter((order) => order.code.toLowerCase().includes(q));
  }, [orders, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ArrowLeftRight className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          {showAccount && <TableHead>Account</TableHead>}
          <TableHead className="text-right">Created</TableHead>
          {onBuy && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <GameIcon type="item" code={order.code} size="sm" />
                {order.code}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  order.type === "buy"
                    ? "text-green-400 border-green-500/30"
                    : "text-red-400 border-red-500/30"
                }
              >
                {order.type.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums text-amber-400">
              {order.price.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {order.quantity.toLocaleString()}
            </TableCell>
            {showAccount && (
              <TableCell className="text-muted-foreground text-sm">
                {order.account ?? "\u2014"}
              </TableCell>
            )}
            <TableCell className="text-right text-muted-foreground text-sm">
              {formatDate(order.created_at)}
            </TableCell>
            {onBuy && (
              <TableCell className="text-right">
                {order.type === "sell" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    onClick={() => onBuy(order)}
                  >
                    <ShoppingCart className="size-3" />
                    Buy
                  </Button>
                ) : null}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MyOrdersTable({
  orders,
  isLoading,
  selectedCharacter,
  onCancel,
  cancelPending,
}: {
  orders: GEOrder[];
  isLoading: boolean;
  selectedCharacter: string;
  onCancel: (orderId: string) => void;
  cancelPending: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ArrowLeftRight className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm">
          You have no active orders on the Grand Exchange.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <GameIcon type="item" code={order.code} size="sm" />
                {order.code}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  order.type === "buy"
                    ? "text-green-400 border-green-500/30"
                    : "text-red-400 border-red-500/30"
                }
              >
                {order.type.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums text-amber-400">
              {order.price.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {order.quantity.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {formatDate(order.created_at)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={!selectedCharacter || cancelPending !== null}
                onClick={() => onCancel(order.id)}
              >
                {cancelPending === order.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3" />
                )}
                Cancel
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HistoryTable({
  entries,
  isLoading,
  emptyMessage,
}: {
  entries: GEHistoryEntry[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <History className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Seller</TableHead>
          <TableHead>Buyer</TableHead>
          <TableHead className="text-right">Sold At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={`${entry.order_id}-${entry.sold_at}`}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <GameIcon type="item" code={entry.code} size="sm" />
                {entry.code}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums text-amber-400">
              {entry.price.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {entry.quantity.toLocaleString()}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {entry.seller}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {entry.buyer}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {formatDate(entry.sold_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ExchangePage() {
  const { data: orders, isLoading: loadingOrders, error: ordersError } = useExchangeOrders();
  const { data: myOrders, isLoading: loadingMyOrders } = useMyOrders();
  const { data: history, isLoading: loadingHistory } = useExchangeHistory();
  const { data: characters } = useCharacters();
  const queryClient = useQueryClient();

  const { data: items } = useItems();

  const [marketSearch, setMarketSearch] = useState("");
  const [priceItemCode, setPriceItemCode] = useState("");
  const [searchedItem, setSearchedItem] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [cancelPending, setCancelPending] = useState<string | null>(null);
  const [buyOrder, setBuyOrder] = useState<GEOrder | null>(null);

  // Buy/Sell form state
  const [buyCode, setBuyCode] = useState("");
  const [buyQty, setBuyQty] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellCode, setSellCode] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [orderPending, setOrderPending] = useState<string | null>(null);

  const {
    data: priceData,
    isLoading: loadingPrices,
  } = usePriceHistory(searchedItem);

  function handlePriceSearch() {
    if (priceItemCode.trim()) {
      setSearchedItem(priceItemCode.trim());
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!selectedCharacter) {
      toast.error("Select a character first");
      return;
    }
    setCancelPending(orderId);
    try {
      await executeAction(selectedCharacter, "ge_cancel", { order_id: orderId });
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["exchange"] });
    } catch (err) {
      toast.error(
        `Cancel failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setCancelPending(null);
    }
  }

  async function handleCreateOrder(type: "ge_create_buy" | "ge_sell") {
    if (!selectedCharacter) {
      toast.error("Select a character first");
      return;
    }
    const code = type === "ge_create_buy" ? buyCode : sellCode;
    const qty = type === "ge_create_buy" ? buyQty : sellQty;
    const price = type === "ge_create_buy" ? buyPrice : sellPrice;

    setOrderPending(type);
    try {
      await executeAction(selectedCharacter, type, {
        code,
        quantity: parseInt(qty, 10) || 1,
        price: parseInt(price, 10) || 0,
      });
      toast.success(`${type === "ge_create_buy" ? "Buy" : "Sell"} order created`);
      queryClient.invalidateQueries({ queryKey: ["exchange"] });
      // Clear form
      if (type === "ge_create_buy") {
        setBuyCode("");
        setBuyQty("1");
        setBuyPrice("");
      } else {
        setSellCode("");
        setSellQty("1");
        setSellPrice("");
      }
    } catch (err) {
      toast.error(
        `Order failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setOrderPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Grand Exchange
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse market orders, create trades, and analyze price history
          </p>
        </div>

        {/* Character selector for actions */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Acting as:
          </Label>
          <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select character" />
            </SelectTrigger>
            <SelectContent>
              {(characters ?? []).map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name} (Lv.{c.level})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ordersError && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load exchange data. Make sure the backend is running.
          </p>
        </Card>
      )}

      <Tabs defaultValue="trade">
        <TabsList>
          <TabsTrigger value="trade" className="gap-1.5">
            <Plus className="size-4" />
            Trade
          </TabsTrigger>
          <TabsTrigger value="market" className="gap-1.5">
            <ShoppingCart className="size-4" />
            Market
          </TabsTrigger>
          <TabsTrigger value="my-orders" className="gap-1.5">
            <User className="size-4" />
            My Orders
            {myOrders && myOrders.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {myOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="size-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="prices" className="gap-1.5">
            <TrendingUp className="size-4" />
            Prices
          </TabsTrigger>
        </TabsList>

        {/* Trade Tab - Create buy/sell orders */}
        <TabsContent value="trade" className="space-y-4">
          {!selectedCharacter && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-400">
                Select a character in the top-right corner to create orders.
                The character must be at the Grand Exchange tile.
              </p>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Buy order form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-green-400 flex items-center gap-2">
                  <ShoppingCart className="size-4" />
                  Create Buy Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Item Code</Label>
                  <Input
                    placeholder="e.g. copper_ore"
                    value={buyCode}
                    onChange={(e) => setBuyCode(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={buyQty}
                      onChange={(e) => setBuyQty(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price Each</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Gold per unit"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                {buyCode && buyPrice && (
                  <p className="text-xs text-muted-foreground">
                    Total cost:{" "}
                    <span className="text-amber-400 font-medium">
                      {((parseInt(buyQty, 10) || 1) * (parseInt(buyPrice, 10) || 0)).toLocaleString()} gold
                    </span>
                  </p>
                )}
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={
                    !selectedCharacter ||
                    !buyCode.trim() ||
                    !buyPrice ||
                    orderPending !== null
                  }
                  onClick={() => handleCreateOrder("ge_create_buy")}
                >
                  {orderPending === "ge_create_buy" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="size-4" />
                  )}
                  Place Buy Order
                </Button>
              </CardContent>
            </Card>

            {/* Sell order form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                  <ShoppingCart className="size-4" />
                  Create Sell Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Item Code</Label>
                  <Input
                    placeholder="e.g. copper_ore"
                    value={sellCode}
                    onChange={(e) => setSellCode(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={sellQty}
                      onChange={(e) => setSellQty(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price Each</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Gold per unit"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                {sellCode && sellPrice && (
                  <p className="text-xs text-muted-foreground">
                    Total value:{" "}
                    <span className="text-amber-400 font-medium">
                      {((parseInt(sellQty, 10) || 1) * (parseInt(sellPrice, 10) || 0)).toLocaleString()} gold
                    </span>
                  </p>
                )}
                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  disabled={
                    !selectedCharacter ||
                    !sellCode.trim() ||
                    !sellPrice ||
                    orderPending !== null
                  }
                  onClick={() => handleCreateOrder("ge_sell")}
                >
                  {orderPending === "ge_sell" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="size-4" />
                  )}
                  Place Sell Order
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Market Tab - Browse all public orders */}
        <TabsContent value="market" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by item code..."
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {!selectedCharacter && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-400">
                Select a character in the top-right corner to buy items directly from sell orders.
              </p>
            </Card>
          )}

          <Card>
            <OrdersTable
              orders={orders ?? []}
              isLoading={loadingOrders}
              search={marketSearch}
              showAccount
              onBuy={selectedCharacter ? (order) => setBuyOrder(order) : undefined}
              emptyMessage={
                marketSearch.trim()
                  ? `No orders found for "${marketSearch}"`
                  : "No active orders on the Grand Exchange."
              }
            />
          </Card>
        </TabsContent>

        {/* My Orders Tab - with cancel buttons */}
        <TabsContent value="my-orders" className="space-y-4">
          {!selectedCharacter && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-400">
                Select a character to cancel orders. The character must be at the Grand Exchange.
              </p>
            </Card>
          )}
          <Card>
            <MyOrdersTable
              orders={myOrders ?? []}
              isLoading={loadingMyOrders}
              selectedCharacter={selectedCharacter}
              onCancel={handleCancelOrder}
              cancelPending={cancelPending}
            />
          </Card>
        </TabsContent>

        {/* Trade History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <HistoryTable
              entries={history ?? []}
              isLoading={loadingHistory}
              emptyMessage="No transaction history found."
            />
          </Card>
        </TabsContent>

        {/* Price History Tab */}
        <TabsContent value="prices" className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Enter item code (e.g. copper_ore)"
              value={priceItemCode}
              onChange={(e) => setPriceItemCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePriceSearch()}
            />
            <Button onClick={handlePriceSearch} disabled={!priceItemCode.trim()}>
              <Search className="size-4" />
              Search
            </Button>
          </div>

          {searchedItem && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GameIcon type="item" code={searchedItem} size="md" showTooltip={false} />
                  Price History: {searchedItem}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPrices ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <PriceChart data={priceData ?? []} />
                )}
              </CardContent>
            </Card>
          )}

          {!searchedItem && (
            <Card className="p-8 text-center">
              <TrendingUp className="size-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Enter an item code above to view price history and volume data.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <BuyEquipDialog
        order={buyOrder}
        characterName={selectedCharacter}
        items={items}
        onOpenChange={(open) => !open && setBuyOrder(null)}
      />
    </div>
  );
}

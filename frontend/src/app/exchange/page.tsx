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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  useExchangeOrders,
  useMyOrders,
  useExchangeHistory,
  usePriceHistory,
} from "@/hooks/use-exchange";
import { PriceChart } from "@/components/exchange/price-chart";
import { GameIcon } from "@/components/ui/game-icon";
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
}: {
  orders: GEOrder[];
  isLoading: boolean;
  search: string;
  emptyMessage: string;
  showAccount?: boolean;
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
                {order.account ?? "—"}
              </TableCell>
            )}
            <TableCell className="text-right text-muted-foreground text-sm">
              {formatDate(order.created_at)}
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

  const [marketSearch, setMarketSearch] = useState("");
  const [priceItemCode, setPriceItemCode] = useState("");
  const [searchedItem, setSearchedItem] = useState("");

  const {
    data: priceData,
    isLoading: loadingPrices,
  } = usePriceHistory(searchedItem);

  function handlePriceSearch() {
    if (priceItemCode.trim()) {
      setSearchedItem(priceItemCode.trim());
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Grand Exchange
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse market orders, track your trades, and analyze price history
        </p>
      </div>

      {ordersError && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load exchange data. Make sure the backend is running.
          </p>
        </Card>
      )}

      <Tabs defaultValue="market">
        <TabsList>
          <TabsTrigger value="market" className="gap-1.5">
            <ShoppingCart className="size-4" />
            Market
          </TabsTrigger>
          <TabsTrigger value="my-orders" className="gap-1.5">
            <User className="size-4" />
            My Orders
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="size-4" />
            Trade History
          </TabsTrigger>
          <TabsTrigger value="prices" className="gap-1.5">
            <TrendingUp className="size-4" />
            Price History
          </TabsTrigger>
        </TabsList>

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

          <Card>
            <OrdersTable
              orders={orders ?? []}
              isLoading={loadingOrders}
              search={marketSearch}
              showAccount
              emptyMessage={
                marketSearch.trim()
                  ? `No orders found for "${marketSearch}"`
                  : "No active orders on the Grand Exchange."
              }
            />
          </Card>
        </TabsContent>

        {/* My Orders Tab - User's own active orders */}
        <TabsContent value="my-orders" className="space-y-4">
          <Card>
            <OrdersTable
              orders={myOrders ?? []}
              isLoading={loadingMyOrders}
              search=""
              emptyMessage="You have no active orders on the Grand Exchange."
            />
          </Card>
        </TabsContent>

        {/* Trade History Tab - User's transaction history */}
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
    </div>
  );
}

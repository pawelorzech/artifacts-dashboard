"use client";

import { useMemo, useState } from "react";
import { Coins, Loader2, Package, Search, Vault } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBank } from "@/hooks/use-bank";

interface BankItem {
  code: string;
  quantity: number;
  type?: string;
  [key: string]: unknown;
}

export default function BankPage() {
  const { data, isLoading, error } = useBank();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "quantity">("code");

  const bankDetails = data?.details as
    | { gold?: number; slots?: number; max_slots?: number }
    | undefined;
  const bankItems = (data?.items ?? []) as BankItem[];

  const filteredItems = useMemo(() => {
    let items = [...bankItems];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter((item) => item.code.toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      if (sortBy === "quantity") return b.quantity - a.quantity;
      return a.code.localeCompare(b.code);
    });

    return items;
  }, [bankItems, search, sortBy]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bank
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage your stored items and gold
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load bank data. Make sure the backend is running.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Coins className="size-4 text-amber-400" />
                  Gold
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold text-amber-400">
                  {(bankDetails?.gold ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Package className="size-4 text-blue-400" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold text-foreground">
                  {bankItems.length}
                </p>
                <p className="text-xs text-muted-foreground">unique items</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Vault className="size-4 text-purple-400" />
                  Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold text-foreground">
                  {bankDetails?.slots ?? 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {bankDetails?.max_slots ?? 0}
                  </span>
                </p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{
                      width: `${
                        bankDetails?.max_slots
                          ? ((bankDetails.slots ?? 0) /
                              bankDetails.max_slots) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as "code" | "quantity")}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">Sort by Code</SelectItem>
                <SelectItem value="quantity">Sort by Quantity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Items Grid */}
          {filteredItems.length > 0 && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredItems.map((item) => (
                <Card
                  key={item.code}
                  className="py-3 px-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.code}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {item.quantity.toLocaleString()}
                      </span>
                      {item.type && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 capitalize"
                        >
                          {item.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {filteredItems.length === 0 && !isLoading && (
            <Card className="p-8 text-center">
              <Package className="size-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {search.trim()
                  ? `No items matching "${search}"`
                  : "Your bank is empty. Deposit items to see them here."}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

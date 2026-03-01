"use client";

import { useMemo, useState } from "react";
import {
  ScrollText,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCharacters } from "@/hooks/use-characters";
import { useLogs } from "@/hooks/use-analytics";
import type { ActionLog } from "@/lib/types";

const ACTION_TYPE_COLORS: Record<string, string> = {
  move: "bg-blue-500/20 text-blue-400",
  fight: "bg-red-500/20 text-red-400",
  gather: "bg-green-500/20 text-green-400",
  rest: "bg-yellow-500/20 text-yellow-400",
  deposit: "bg-purple-500/20 text-purple-400",
  withdraw: "bg-cyan-500/20 text-cyan-400",
  craft: "bg-emerald-500/20 text-emerald-400",
  buy: "bg-teal-500/20 text-teal-400",
  sell: "bg-pink-500/20 text-pink-400",
  equip: "bg-orange-500/20 text-orange-400",
  unequip: "bg-orange-500/20 text-orange-400",
  use: "bg-amber-500/20 text-amber-400",
  task: "bg-indigo-500/20 text-indigo-400",
};

function getActionColor(type: string): string {
  return ACTION_TYPE_COLORS[type] ?? "bg-muted text-muted-foreground";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDetailsString(log: ActionLog): string {
  const d = log.details;
  if (!d || Object.keys(d).length === 0) return "-";

  const parts: string[] = [];
  if (d.reason && typeof d.reason === "string") return d.reason;
  if (d.message && typeof d.message === "string") return d.message;
  if (d.error && typeof d.error === "string") return d.error;
  if (d.result && typeof d.result === "string") return d.result;

  if (d.monster) parts.push(`monster: ${d.monster}`);
  if (d.resource) parts.push(`resource: ${d.resource}`);
  if (d.item) parts.push(`item: ${d.item}`);
  if (d.x !== undefined && d.y !== undefined) parts.push(`(${d.x}, ${d.y})`);
  if (d.xp) parts.push(`xp: +${d.xp}`);
  if (d.gold) parts.push(`gold: ${d.gold}`);
  if (d.quantity) parts.push(`qty: ${d.quantity}`);

  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(d);
}

const ALL_ACTION_TYPES = [
  "move",
  "fight",
  "gather",
  "rest",
  "deposit",
  "withdraw",
  "craft",
  "buy",
  "sell",
  "equip",
  "unequip",
  "use",
  "task",
];

export default function LogsPage() {
  const { data: characters } = useCharacters();
  const [characterFilter, setCharacterFilter] = useState("_all");
  const [actionFilter, setActionFilter] = useState("_all");
  const [visibleCount, setVisibleCount] = useState(50);

  const { data: logs, isLoading, error } = useLogs({
    character: characterFilter === "_all" ? undefined : characterFilter,
  });

  const filteredLogs = useMemo(() => {
    let items = logs ?? [];

    if (actionFilter !== "_all") {
      items = items.filter((log) => log.action_type === actionFilter);
    }

    // Sort by created_at descending
    return [...items].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [logs, actionFilter]);

  const visibleLogs = filteredLogs.slice(0, visibleCount);
  const hasMore = visibleCount < filteredLogs.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Action Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View detailed action logs across all characters
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load logs. Make sure the backend is running.
          </p>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={characterFilter} onValueChange={setCharacterFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Characters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Characters</SelectItem>
            {characters?.map((char) => (
              <SelectItem key={char.name} value={char.name}>
                {char.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Actions</SelectItem>
            {ALL_ACTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                <span className="capitalize">{type}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filteredLogs.length > 0 && (
          <div className="flex items-center text-xs text-muted-foreground self-center ml-auto">
            Showing {visibleLogs.length} of {filteredLogs.length} entries
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Log Table */}
      {visibleLogs.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead className="w-32">Character</TableHead>
                <TableHead className="w-24">Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-16 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.character_name ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border-0 capitalize ${getActionColor(log.action_type)}`}
                    >
                      {log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {getDetailsString(log)}
                  </TableCell>
                  <TableCell className="text-center">
                    {log.success ? (
                      <CheckCircle className="size-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="size-4 text-red-500 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + 50)}
          >
            <ChevronDown className="size-4" />
            Load More
          </Button>
        </div>
      )}

      {/* Empty state */}
      {filteredLogs.length === 0 && !isLoading && (
        <Card className="p-8 text-center">
          <ScrollText className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No log entries found. Actions performed by characters or automations
            will appear here.
          </p>
        </Card>
      )}
    </div>
  );
}

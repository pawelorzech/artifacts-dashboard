"use client";

import { useEffect, useRef } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { AutomationLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_TYPE_COLORS: Record<string, string> = {
  move: "bg-blue-500/20 text-blue-400",
  fight: "bg-red-500/20 text-red-400",
  gather: "bg-green-500/20 text-green-400",
  rest: "bg-yellow-500/20 text-yellow-400",
  deposit: "bg-purple-500/20 text-purple-400",
  withdraw: "bg-cyan-500/20 text-cyan-400",
  equip: "bg-orange-500/20 text-orange-400",
  unequip: "bg-orange-500/20 text-orange-400",
  craft: "bg-emerald-500/20 text-emerald-400",
  use: "bg-amber-500/20 text-amber-400",
  buy: "bg-teal-500/20 text-teal-400",
  sell: "bg-pink-500/20 text-pink-400",
};

function getActionTypeColor(actionType: string): string {
  return ACTION_TYPE_COLORS[actionType] ?? "bg-muted text-muted-foreground";
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffS = Math.floor(diffMs / 1000);

  if (diffS < 5) return "just now";
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function getLogReason(log: AutomationLog): string {
  const details = log.details;
  if (details.reason && typeof details.reason === "string") return details.reason;
  if (details.message && typeof details.message === "string")
    return details.message;
  if (details.error && typeof details.error === "string") return details.error;
  if (details.result && typeof details.result === "string")
    return details.result;

  // Build a summary from known fields
  const parts: string[] = [];
  if (details.monster) parts.push(`monster: ${details.monster}`);
  if (details.resource) parts.push(`resource: ${details.resource}`);
  if (details.item) parts.push(`item: ${details.item}`);
  if (details.x !== undefined && details.y !== undefined)
    parts.push(`(${details.x}, ${details.y})`);
  if (details.hp) parts.push(`hp: ${details.hp}`);
  if (details.gold) parts.push(`gold: ${details.gold}`);
  if (details.xp) parts.push(`xp: +${details.xp}`);
  if (details.quantity) parts.push(`qty: ${details.quantity}`);

  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(details);
}

interface LogStreamProps {
  logs: AutomationLog[];
  maxHeight?: string;
}

export function LogStream({ logs, maxHeight = "400px" }: LogStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No log entries yet. Start the automation to see activity.
      </div>
    );
  }

  return (
    <ScrollArea className="rounded-md border" style={{ height: maxHeight }}>
      <div className="space-y-0.5 p-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className={cn(
              "flex items-start gap-2 rounded px-2 py-1.5 text-xs",
              log.success
                ? "text-foreground"
                : "bg-red-500/5 text-red-300"
            )}
          >
            <span className="shrink-0 w-14 text-muted-foreground tabular-nums">
              {formatRelativeTime(log.created_at)}
            </span>

            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px] px-1.5 py-0 border-0",
                getActionTypeColor(log.action_type)
              )}
            >
              {log.action_type}
            </Badge>

            {log.success ? (
              <CheckCircle className="size-3 shrink-0 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="size-3 shrink-0 text-red-500 mt-0.5" />
            )}

            <span className="min-w-0 break-words text-muted-foreground">
              {getLogReason(log)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

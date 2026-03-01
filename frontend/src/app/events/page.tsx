"use client";

import { useMemo } from "react";
import {
  Zap,
  Loader2,
  MapPin,
  Clock,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEvents, useEventHistory } from "@/hooks/use-events";
import type { GameEvent } from "@/lib/types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = then - now;

  if (diffMs <= 0) return "Ended";

  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return `${diffS}s remaining`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m remaining`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ${diffM % 60}m remaining`;
  return `${Math.floor(diffH / 24)}d ${diffH % 24}h remaining`;
}

function getEventDescription(event: GameEvent): string {
  if (event.data.description && typeof event.data.description === "string") {
    return event.data.description;
  }
  if (event.data.name && typeof event.data.name === "string") {
    return event.data.name;
  }
  return "Game event";
}

function getEventLocation(event: GameEvent): string | null {
  if (event.data.map && typeof event.data.map === "string") {
    return event.data.map;
  }
  if (
    event.data.x !== undefined &&
    event.data.y !== undefined
  ) {
    return `(${event.data.x}, ${event.data.y})`;
  }
  return null;
}

function getEventExpiry(event: GameEvent): string | null {
  if (event.data.expiration && typeof event.data.expiration === "string") {
    return event.data.expiration;
  }
  if (event.data.expires_at && typeof event.data.expires_at === "string") {
    return event.data.expires_at;
  }
  return null;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  portal: "text-purple-400 border-purple-500/30",
  boss: "text-red-400 border-red-500/30",
  resource: "text-green-400 border-green-500/30",
  bonus: "text-amber-400 border-amber-500/30",
  special: "text-cyan-400 border-cyan-500/30",
};

function getEventTypeStyle(type: string): string {
  return EVENT_TYPE_COLORS[type] ?? "text-muted-foreground border-border";
}

function ActiveEventCard({ event }: { event: GameEvent }) {
  const location = getEventLocation(event);
  const expiry = getEventExpiry(event);

  return (
    <Card className="py-4">
      <CardContent className="px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-400" />
            <Badge
              variant="outline"
              className={`capitalize ${getEventTypeStyle(event.type)}`}
            >
              {event.type}
            </Badge>
          </div>
          {expiry && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <Clock className="size-3" />
              <span>{formatRelativeTime(expiry)}</span>
            </div>
          )}
        </div>

        <p className="text-sm text-foreground">{getEventDescription(event)}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {location && (
            <div className="flex items-center gap-1">
              <MapPin className="size-3" />
              <span>{location}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <CalendarDays className="size-3" />
            <span>{formatDate(event.created_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventsPage() {
  const { data: activeEvents, isLoading: loadingActive, error } = useEvents();
  const { data: historicalEvents, isLoading: loadingHistory } =
    useEventHistory();

  const sortedHistory = useMemo(() => {
    if (!historicalEvents) return [];
    return [...historicalEvents].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [historicalEvents]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Events
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View active game events and historical event data. Updates every 10
          seconds.
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load events. Make sure the backend is running.
          </p>
        </Card>
      )}

      {/* Active Events */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Zap className="size-5 text-amber-400" />
          Active Events
        </h2>

        {loadingActive && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {activeEvents && activeEvents.length > 0 && (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {activeEvents.map((event, idx) => (
              <ActiveEventCard key={event.id ?? idx} event={event} />
            ))}
          </div>
        )}

        {activeEvents && activeEvents.length === 0 && !loadingActive && (
          <Card className="p-6 text-center">
            <Zap className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No active events right now. Check back later.
            </p>
          </Card>
        )}
      </div>

      {/* Historical Events */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="size-5 text-muted-foreground" />
          Event History
        </h2>

        {loadingHistory && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {sortedHistory.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((event, idx) => (
                  <TableRow key={event.id ?? idx}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${getEventTypeStyle(event.type)}`}
                      >
                        {event.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getEventDescription(event)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getEventLocation(event) ?? "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(event.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {sortedHistory.length === 0 && !loadingHistory && (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground text-sm">
              No historical events recorded yet.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

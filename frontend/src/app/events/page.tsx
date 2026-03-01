"use client";

import { useMemo } from "react";
import {
  Zap,
  Loader2,
  MapPin,
  Clock,
  CalendarDays,
  Sparkles,
  Swords,
  Trees,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import type { ActiveGameEvent, HistoricalEvent } from "@/lib/types";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CONTENT_TYPE_STYLES: Record<string, { icon: typeof Swords; color: string }> = {
  monster: { icon: Swords, color: "text-red-400 border-red-500/30" },
  resource: { icon: Trees, color: "text-green-400 border-green-500/30" },
};

function ActiveEventCard({ event }: { event: ActiveGameEvent }) {
  const style = CONTENT_TYPE_STYLES[event.content.type] ?? {
    icon: Sparkles,
    color: "text-muted-foreground border-border",
  };
  const Icon = style.icon;
  const locations = event.maps.slice(0, 3);

  return (
    <Card className="py-4">
      <CardContent className="px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-amber-400" />
            <Badge variant="outline" className={`capitalize ${style.color}`}>
              {event.content.type}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{formatDuration(event.duration)}</span>
          </div>
        </div>

        <p className="text-sm font-medium text-foreground">{event.name}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {event.content.code.replaceAll("_", " ")}
        </p>

        {locations.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {locations.map((m) => (
              <div key={m.map_id} className="flex items-center gap-1">
                <MapPin className="size-3" />
                <span>({m.x}, {m.y})</span>
              </div>
            ))}
            {event.maps.length > 3 && (
              <span className="text-muted-foreground/60">
                +{event.maps.length - 3} more
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryRow({ event }: { event: HistoricalEvent }) {
  const location =
    event.map_x !== undefined && event.map_y !== undefined
      ? `(${event.map_x}, ${event.map_y})`
      : "-";

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {event.event_type}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {event.character_name ?? "-"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {location}
      </TableCell>
      <TableCell className="text-right text-muted-foreground text-sm">
        {formatDate(event.created_at)}
      </TableCell>
    </TableRow>
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
            {activeEvents.map((event) => (
              <ActiveEventCard key={event.code} event={event} />
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
                  <TableHead>Character</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((event) => (
                  <HistoryRow key={event.id} event={event} />
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

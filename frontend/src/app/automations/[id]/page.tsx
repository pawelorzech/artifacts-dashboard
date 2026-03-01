"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Swords,
  Pickaxe,
  Bot,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  useAutomation,
  useAutomationStatuses,
  useAutomationLogs,
} from "@/hooks/use-automations";
import { RunControls } from "@/components/automation/run-controls";
import { LogStream } from "@/components/automation/log-stream";
import { cn } from "@/lib/utils";

const STRATEGY_ICONS: Record<string, React.ReactNode> = {
  combat: <Swords className="size-5 text-red-400" />,
  gathering: <Pickaxe className="size-5 text-green-400" />,
  crafting: <Bot className="size-5 text-blue-400" />,
  trading: <Bot className="size-5 text-yellow-400" />,
  task: <Bot className="size-5 text-purple-400" />,
  leveling: <Bot className="size-5 text-cyan-400" />,
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  running: "bg-green-600 text-white",
  paused: "bg-yellow-600 text-white",
  stopped: "",
  error: "bg-red-600 text-white",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function formatDuration(start: string, end: string | null): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = endTime - startTime;
  const diffS = Math.floor(diffMs / 1000);

  if (diffS < 60) return `${diffS}s`;
  const m = Math.floor(diffS / 60);
  const s = diffS % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function ConfigDisplay({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No configuration set.</p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {key.replace(/_/g, " ")}
          </span>
          <span className="text-sm font-medium text-foreground">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const id = parseInt(idStr, 10);
  const router = useRouter();

  const { data, isLoading, error } = useAutomation(id);
  const { data: statuses } = useAutomationStatuses();
  const { data: logs } = useAutomationLogs(id);

  const status = statuses?.find((s) => s.config_id === id);
  const currentStatus = status?.status ?? "stopped";
  const actionsCount = status?.actions_count ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/automations")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load automation. It may have been deleted.
          </p>
        </Card>
      </div>
    );
  }

  const { config: automation, runs } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="mt-1"
          onClick={() => router.push("/automations")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {STRATEGY_ICONS[automation.strategy_type] ?? (
              <Bot className="size-5" />
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {automation.name}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {automation.character_name} &middot;{" "}
            <span className="capitalize">{automation.strategy_type}</span>{" "}
            strategy
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="px-4 py-3">
        <RunControls
          automationId={id}
          status={currentStatus}
          actionsCount={actionsCount}
        />
      </Card>

      {/* Tabs: Config / Runs / Logs */}
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Live Logs</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Log Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <LogStream logs={logs ?? []} maxHeight="500px" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Strategy Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigDisplay config={automation.config} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No runs yet. Start the automation to create a run.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          <Badge
                            variant={
                              run.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                            className={cn(
                              STATUS_BADGE_CLASSES[run.status]
                            )}
                          >
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {formatDate(run.started_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDuration(
                              run.started_at,
                              run.stopped_at
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {run.actions_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {run.error_message && (
                            <span className="text-xs text-red-400 truncate block">
                              {run.error_message}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

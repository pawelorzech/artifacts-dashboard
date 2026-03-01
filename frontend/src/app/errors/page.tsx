"use client";

import { Fragment, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Bug,
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
import { useErrors, useErrorStats, useResolveError } from "@/hooks/use-errors";
import type { AppError } from "@/lib/types";

const PAGE_SIZE = 50;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600/20 text-red-400",
  error: "bg-red-500/20 text-red-400",
  warning: "bg-yellow-500/20 text-yellow-400",
};

const SOURCE_COLORS: Record<string, string> = {
  backend: "bg-blue-500/20 text-blue-400",
  frontend: "bg-purple-500/20 text-purple-400",
  automation: "bg-green-500/20 text-green-400",
  middleware: "bg-orange-500/20 text-orange-400",
};

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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md ${color}`}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function ExpandedRow({ error }: { error: AppError }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/30 p-4">
        <div className="space-y-3 text-sm">
          {error.correlation_id && (
            <div>
              <span className="text-muted-foreground">Correlation ID: </span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {error.correlation_id}
              </code>
            </div>
          )}
          {error.context && Object.keys(error.context).length > 0 && (
            <div>
              <span className="text-muted-foreground">Context:</span>
              <pre className="mt-1 text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-40">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
          {error.stack_trace && (
            <div>
              <span className="text-muted-foreground">Stack Trace:</span>
              <pre className="mt-1 text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-60 whitespace-pre-wrap">
                {error.stack_trace}
              </pre>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ErrorsPage() {
  const [severityFilter, setSeverityFilter] = useState("_all");
  const [sourceFilter, setSourceFilter] = useState("_all");
  const [resolvedFilter, setResolvedFilter] = useState("_all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, error } = useErrors({
    severity: severityFilter === "_all" ? undefined : severityFilter,
    source: sourceFilter === "_all" ? undefined : sourceFilter,
    resolved: resolvedFilter === "_all" ? undefined : resolvedFilter,
    page,
    size: PAGE_SIZE,
  });

  const { data: stats } = useErrorStats();
  const resolveMutation = useResolveError();

  const errors = data?.errors ?? [];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  function handleFilterChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Error Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Application errors from backend, frontend, and automations
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load errors. Make sure the backend is running.
          </p>
        </Card>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Errors"
            value={stats.total}
            icon={Bug}
            color="bg-red-500/20 text-red-400"
          />
          <StatCard
            label="Unresolved"
            value={stats.unresolved}
            icon={XCircle}
            color="bg-orange-500/20 text-orange-400"
          />
          <StatCard
            label="Last Hour"
            value={stats.last_hour}
            icon={Clock}
            color="bg-yellow-500/20 text-yellow-400"
          />
          <StatCard
            label="Resolved"
            value={stats.total - stats.unresolved}
            icon={CheckCircle2}
            color="bg-green-500/20 text-green-400"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={severityFilter}
          onValueChange={handleFilterChange(setSeverityFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sourceFilter}
          onValueChange={handleFilterChange(setSourceFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Sources</SelectItem>
            <SelectItem value="backend">Backend</SelectItem>
            <SelectItem value="frontend">Frontend</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
            <SelectItem value="middleware">Middleware</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={resolvedFilter}
          onValueChange={handleFilterChange(setResolvedFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Status</SelectItem>
            <SelectItem value="false">Unresolved</SelectItem>
            <SelectItem value="true">Resolved</SelectItem>
          </SelectContent>
        </Select>

        {total > 0 && (
          <div className="flex items-center text-xs text-muted-foreground self-center ml-auto">
            {total.toLocaleString()} total errors
          </div>
        )}
      </div>

      {isLoading && errors.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error Table */}
      {errors.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-40">Time</TableHead>
                <TableHead className="w-24">Severity</TableHead>
                <TableHead className="w-28">Source</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-24 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err) => (
                <Fragment key={err.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === err.id ? null : err.id)
                    }
                  >
                    <TableCell className="px-2">
                      {expandedId === err.id ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(err.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border-0 capitalize ${
                          SEVERITY_COLORS[err.severity] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {err.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border-0 capitalize ${
                          SOURCE_COLORS[err.source] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {err.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="flex items-center gap-2">
                        {err.resolved && (
                          <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="text-sm font-medium">
                            {err.error_type}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2 truncate">
                            {err.message}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {!err.resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={resolveMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveMutation.mutate(err.id);
                          }}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === err.id && (
                    <ExpandedRow key={`${err.id}-expanded`} error={err} />
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Empty state */}
      {errors.length === 0 && !isLoading && (
        <Card className="p-8 text-center">
          <AlertTriangle className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No errors found. That&apos;s a good sign!
          </p>
        </Card>
      )}
    </div>
  );
}

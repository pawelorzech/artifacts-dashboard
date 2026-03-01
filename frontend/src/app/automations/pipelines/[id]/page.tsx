"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePipeline, usePipelineStatuses, useDeletePipeline } from "@/hooks/use-pipelines";
import { PipelineProgress } from "@/components/pipeline/pipeline-progress";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const router = useRouter();
  const { data, isLoading, error } = usePipeline(id);
  const { data: statuses } = usePipelineStatuses();
  const deleteMutation = useDeletePipeline();

  const status = (statuses ?? []).find((s) => s.pipeline_id === id) ?? null;

  function handleDelete() {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Pipeline deleted");
        router.push("/automations");
      },
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive bg-destructive/10 p-4">
        <p className="text-sm text-destructive">
          Failed to load pipeline. It may have been deleted.
        </p>
        <Link href="/automations" className="mt-2 inline-block">
          <Button variant="outline" size="sm">
            Back to Automations
          </Button>
        </Link>
      </Card>
    );
  }

  const { config, runs } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/automations">
            <Button variant="ghost" size="icon-xs">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {config.name}
              </h1>
              {config.loop && (
                <Repeat className="size-4 text-muted-foreground" />
              )}
            </div>
            {config.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {config.description}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>

      {/* Live progress */}
      <PipelineProgress config={config} status={status} />

      {/* Stages overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Stages ({config.stages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {config.stages.map((stage, idx) => (
              <div key={stage.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    Stage {idx + 1}
                  </Badge>
                  <span className="text-sm font-medium">{stage.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {stage.character_steps.length} worker
                    {stage.character_steps.length !== 1 && "s"}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {stage.character_steps.map((cs) => (
                    <div
                      key={cs.id}
                      className="text-xs bg-muted/30 rounded p-2 space-y-0.5"
                    >
                      <div className="font-medium">{cs.character_name}</div>
                      <div className="text-muted-foreground capitalize">
                        {cs.strategy_type}
                      </div>
                      {cs.transition && (
                        <div className="text-muted-foreground">
                          Until: {cs.transition.type}
                          {cs.transition.value != null &&
                            ` ${cs.transition.operator ?? ">="} ${cs.transition.value}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run history */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Run History ({runs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Stopped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 20).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">
                      #{run.id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "error" ? "destructive" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.current_stage_index + 1}
                      {run.loop_count > 0 && ` (loop ${run.loop_count})`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {run.total_actions_count}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.stopped_at
                        ? new Date(run.stopped_at).toLocaleString()
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

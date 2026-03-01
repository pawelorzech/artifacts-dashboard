"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Swords,
  Pickaxe,
  Bot,
  Loader2,
  LayoutGrid,
  List,
  GitBranch,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useAutomations,
  useAutomationStatuses,
  useDeleteAutomation,
} from "@/hooks/use-automations";
import { useWorkflows } from "@/hooks/use-workflows";
import { usePipelines } from "@/hooks/use-pipelines";
import { RunControls } from "@/components/automation/run-controls";
import { AutomationGallery } from "@/components/automation/automation-gallery";
import { WorkflowList } from "@/components/workflow/workflow-list";
import { WorkflowTemplateGallery } from "@/components/workflow/workflow-template-gallery";
import { PipelineList } from "@/components/pipeline/pipeline-list";
import { PipelineTemplateGallery } from "@/components/pipeline/pipeline-template-gallery";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STRATEGY_ICONS: Record<string, React.ReactNode> = {
  combat: <Swords className="size-4 text-red-400" />,
  gathering: <Pickaxe className="size-4 text-green-400" />,
  crafting: <Bot className="size-4 text-blue-400" />,
  trading: <Bot className="size-4 text-yellow-400" />,
  task: <Bot className="size-4 text-purple-400" />,
  leveling: <Bot className="size-4 text-cyan-400" />,
};

const STRATEGY_COLORS: Record<string, string> = {
  combat: "text-red-400",
  gathering: "text-green-400",
  crafting: "text-blue-400",
  trading: "text-yellow-400",
  task: "text-purple-400",
  leveling: "text-cyan-400",
};

export default function AutomationsPage() {
  const router = useRouter();
  const { data: automations, isLoading, error } = useAutomations();
  const { data: statuses } = useAutomationStatuses();
  const { data: workflows } = useWorkflows();
  const { data: pipelines } = usePipelines();
  const deleteMutation = useDeleteAutomation();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const statusMap = new Map(
    (statuses ?? []).map((s) => [s.config_id, s])
  );

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`Automation "${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(`Failed to delete: ${err.message}`);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Automations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage automated strategies for your characters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/automations/pipelines/new")}
          >
            <Network className="size-4" />
            New Pipeline
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/automations/workflows/new")}
          >
            <GitBranch className="size-4" />
            New Workflow
          </Button>
          <Button onClick={() => router.push("/automations/new")}>
            <Plus className="size-4" />
            New Automation
          </Button>
        </div>
      </div>

      <Tabs defaultValue="gallery">
        <TabsList>
          <TabsTrigger value="gallery" className="gap-1.5">
            <LayoutGrid className="size-3.5" />
            Gallery
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <List className="size-3.5" />
            My Automations
            {automations && automations.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {automations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5">
            <GitBranch className="size-3.5" />
            Workflows
            {workflows && workflows.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {workflows.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="gap-1.5">
            <Network className="size-3.5" />
            Pipelines
            {pipelines && pipelines.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {pipelines.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-6 space-y-8">
          <AutomationGallery />
          <WorkflowTemplateGallery />
          <PipelineTemplateGallery />
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {error && (
            <Card className="border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                Failed to load automations. Make sure the backend is running.
              </p>
            </Card>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {automations && automations.length === 0 && !isLoading && (
            <Card className="p-8 text-center">
              <Bot className="size-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No automations configured yet. Pick one from the Gallery or
                create a custom one.
              </p>
              <Button onClick={() => router.push("/automations/new")}>
                <Plus className="size-4" />
                Create Automation
              </Button>
            </Card>
          )}

          {automations && automations.length > 0 && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Character</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Status / Controls</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((automation) => {
                    const status = statusMap.get(automation.id);
                    const currentStatus = status?.status ?? "stopped";
                    const actionsCount = status?.actions_count ?? 0;

                    return (
                      <TableRow
                        key={automation.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/automations/${automation.id}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {automation.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {automation.character_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {STRATEGY_ICONS[automation.strategy_type] ?? (
                              <Bot className="size-4" />
                            )}
                            <span
                              className={cn(
                                "capitalize text-sm",
                                STRATEGY_COLORS[automation.strategy_type]
                              )}
                            >
                              {automation.strategy_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <RunControls
                            automationId={automation.id}
                            status={currentStatus}
                            actionsCount={actionsCount}
                          />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                id: automation.id,
                                name: automation.name,
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="mt-6">
          <WorkflowList />
        </TabsContent>

        <TabsContent value="pipelines" className="mt-6">
          <PipelineList />
        </TabsContent>
      </Tabs>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Automation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}
              &rdquo;? This action cannot be undone. Any running automation
              will be stopped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

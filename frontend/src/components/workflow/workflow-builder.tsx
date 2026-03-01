"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ArrowLeft, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowStepCard } from "@/components/workflow/workflow-step-card";
import { useCharacters } from "@/hooks/use-characters";
import { useCreateWorkflow } from "@/hooks/use-workflows";
import type { WorkflowStep } from "@/lib/types";
import { toast } from "sonner";

function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeEmptyStep(): WorkflowStep {
  return {
    id: generateId(),
    name: "",
    strategy_type: "gathering",
    config: { resource_code: "", deposit_on_full: true, max_loops: 0 },
    transition: null,
  };
}

interface WorkflowBuilderProps {
  /** If provided, pre-populates the builder (e.g. from a template). */
  initialSteps?: WorkflowStep[];
  initialName?: string;
  initialDescription?: string;
  initialLoop?: boolean;
  initialMaxLoops?: number;
}

export function WorkflowBuilder({
  initialSteps,
  initialName = "",
  initialDescription = "",
  initialLoop = false,
  initialMaxLoops = 0,
}: WorkflowBuilderProps) {
  const router = useRouter();
  const { data: characters, isLoading: loadingCharacters } = useCharacters();
  const createMutation = useCreateWorkflow();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [characterName, setCharacterName] = useState("");
  const [loop, setLoop] = useState(initialLoop);
  const [maxLoops, setMaxLoops] = useState(initialMaxLoops);
  const [steps, setSteps] = useState<WorkflowStep[]>(
    initialSteps ?? [makeEmptyStep()]
  );

  function updateStep(index: number, updated: WorkflowStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, makeEmptyStep()]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(from: number, to: number) {
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Please enter a workflow name");
      return;
    }
    if (!characterName) {
      toast.error("Please select a character");
      return;
    }
    if (steps.length === 0) {
      toast.error("Add at least one step");
      return;
    }
    const hasEmptyStrategy = steps.some((s) => !s.strategy_type);
    if (hasEmptyStrategy) {
      toast.error("All steps must have a strategy selected");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        character_name: characterName,
        description: description.trim() || undefined,
        steps: steps.map((s) => ({
          id: s.id,
          name: s.name || `Step ${steps.indexOf(s) + 1}`,
          strategy_type: s.strategy_type,
          config: s.config,
          transition: s.transition,
        })),
        loop,
        max_loops: maxLoops,
      },
      {
        onSuccess: () => {
          toast.success("Workflow created successfully");
          router.push("/automations");
        },
        onError: (err) => {
          toast.error(`Failed to create workflow: ${err.message}`);
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/automations")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            New Workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chain multiple strategies into a multi-step pipeline
          </p>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            Basic Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wf-name">Workflow Name</Label>
            <Input
              id="wf-name"
              placeholder="e.g. Copper Pipeline, Mining Progression"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wf-desc">Description (optional)</Label>
            <Textarea
              id="wf-desc"
              rows={2}
              placeholder="Brief description of what this workflow does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Character</Label>
            <Select value={characterName} onValueChange={setCharacterName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a character" />
              </SelectTrigger>
              <SelectContent>
                {loadingCharacters && (
                  <SelectItem value="_loading" disabled>
                    Loading characters...
                  </SelectItem>
                )}
                {characters?.map((char) => (
                  <SelectItem key={char.name} value={char.name}>
                    {char.name} (Lv. {char.level})
                  </SelectItem>
                ))}
                {characters?.length === 0 && (
                  <SelectItem value="_empty" disabled>
                    No characters found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Repeat className="size-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Loop Workflow</Label>
                <p className="text-xs text-muted-foreground">
                  Restart from step 1 after the last step completes
                </p>
              </div>
            </div>
            <Switch checked={loop} onCheckedChange={setLoop} />
          </div>

          {loop && (
            <div className="space-y-2">
              <Label htmlFor="max-loops">Max Loops</Label>
              <Input
                id="max-loops"
                type="number"
                min={0}
                placeholder="0 = infinite"
                value={maxLoops}
                onChange={(e) => setMaxLoops(parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Max number of loop iterations. 0 = run forever.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            Pipeline Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No steps yet. Add your first step below.
            </p>
          )}

          {steps.map((step, idx) => (
            <WorkflowStepCard
              key={step.id}
              step={step}
              index={idx}
              totalSteps={steps.length}
              onChange={(updated) => updateStep(idx, updated)}
              onMoveUp={() => moveStep(idx, idx - 1)}
              onMoveDown={() => moveStep(idx, idx + 1)}
              onDelete={() => removeStep(idx)}
            />
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={addStep}
          >
            <Plus className="size-4" />
            Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Create button */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/automations")}
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          disabled={
            !name.trim() ||
            !characterName ||
            steps.length === 0 ||
            createMutation.isPending
          }
        >
          {createMutation.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Create Workflow
        </Button>
      </div>
    </div>
  );
}

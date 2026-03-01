"use client";

import { useSearchParams } from "next/navigation";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";
import {
  WORKFLOW_TEMPLATES,
} from "@/components/workflow/workflow-templates";
import type { WorkflowStep } from "@/lib/types";

export default function NewWorkflowPage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const template = templateId
    ? WORKFLOW_TEMPLATES.find((t) => t.id === templateId)
    : null;

  const initialSteps: WorkflowStep[] | undefined = template
    ? template.steps.map((s) => ({
        id: s.id,
        name: s.name,
        strategy_type: s.strategy_type as WorkflowStep["strategy_type"],
        config: s.config as Record<string, unknown>,
        transition: s.transition
          ? {
              type: s.transition.type as WorkflowStep["transition"] extends null ? never : NonNullable<WorkflowStep["transition"]>["type"],
              operator: (s.transition.operator ?? ">=") as ">=" | "<=" | "==" | ">" | "<",
              value: s.transition.value ?? 0,
              item_code: s.transition.item_code ?? "",
              skill: s.transition.skill ?? "",
              seconds: s.transition.seconds ?? 0,
            }
          : null,
      }))
    : undefined;

  return (
    <WorkflowBuilder
      initialSteps={initialSteps}
      initialName={template?.name ?? ""}
      initialDescription={template?.description ?? ""}
      initialLoop={template?.loop ?? false}
      initialMaxLoops={template?.max_loops ?? 0}
    />
  );
}

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineBuilder } from "@/components/pipeline/pipeline-builder";

export default function NewPipelinePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/automations">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            New Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a multi-character pipeline with sequential stages
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <PipelineBuilder />
      </Suspense>
    </div>
  );
}

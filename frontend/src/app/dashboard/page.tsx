"use client";

import { useDashboard } from "@/hooks/use-characters";
import { CharacterCard } from "@/components/dashboard/character-card";
import { Card } from "@/components/ui/card";

function CharacterCardSkeleton() {
  return (
    <Card className="animate-pulse p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-5 w-12 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="flex gap-2 mt-4">
          <div className="h-6 w-16 rounded bg-muted" />
          <div className="h-6 w-16 rounded bg-muted" />
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of all characters and server status
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load dashboard data. Make sure the backend is running.
          </p>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <CharacterCardSkeleton key={i} />
          ))}

        {data?.characters.map((character) => (
          <CharacterCard key={character.name} character={character} />
        ))}
      </div>

      {data && data.characters.length === 0 && !isLoading && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No characters found. Make sure the backend is connected to the
            Artifacts API.
          </p>
        </Card>
      )}
    </div>
  );
}

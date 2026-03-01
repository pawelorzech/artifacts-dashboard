"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StrategySelector } from "@/components/automation/strategy-selector";
import {
  ConfigForm,
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_GATHERING_CONFIG,
  DEFAULT_CRAFTING_CONFIG,
  DEFAULT_TRADING_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_LEVELING_CONFIG,
} from "@/components/automation/config-form";
import { useCharacters } from "@/hooks/use-characters";
import { useCreateAutomation } from "@/hooks/use-automations";
import { toast } from "sonner";

type StrategyType =
  | "combat"
  | "gathering"
  | "crafting"
  | "trading"
  | "task"
  | "leveling";

const DEFAULT_CONFIGS: Record<StrategyType, Record<string, unknown>> = {
  combat: DEFAULT_COMBAT_CONFIG as unknown as Record<string, unknown>,
  gathering: DEFAULT_GATHERING_CONFIG as unknown as Record<string, unknown>,
  crafting: DEFAULT_CRAFTING_CONFIG as unknown as Record<string, unknown>,
  trading: DEFAULT_TRADING_CONFIG as unknown as Record<string, unknown>,
  task: DEFAULT_TASK_CONFIG as unknown as Record<string, unknown>,
  leveling: DEFAULT_LEVELING_CONFIG as unknown as Record<string, unknown>,
};

export default function NewAutomationPage() {
  const router = useRouter();
  const { data: characters, isLoading: loadingCharacters } = useCharacters();
  const createMutation = useCreateAutomation();

  const [name, setName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [strategyType, setStrategyType] = useState<StrategyType | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});

  function handleStrategyChange(strategy: StrategyType) {
    setStrategyType(strategy);
    setConfig(DEFAULT_CONFIGS[strategy]);
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Please enter a name for the automation");
      return;
    }
    if (!characterName) {
      toast.error("Please select a character");
      return;
    }
    if (!strategyType) {
      toast.error("Please select a strategy");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        character_name: characterName,
        strategy_type: strategyType,
        config,
      },
      {
        onSuccess: () => {
          toast.success("Automation created successfully");
          router.push("/automations");
        },
        onError: (err) => {
          toast.error(`Failed to create automation: ${err.message}`);
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
            New Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a new automated strategy
          </p>
        </div>
      </div>

      {/* Step 1: Name + Character */}
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
            <Label htmlFor="automation-name">Automation Name</Label>
            <Input
              id="automation-name"
              placeholder="e.g. Farm Chickens, Mine Copper"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
        </CardContent>
      </Card>

      {/* Step 2: Strategy */}
      <Card className={!characterName ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            Select Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StrategySelector
            value={strategyType}
            onChange={handleStrategyChange}
          />
        </CardContent>
      </Card>

      {/* Step 3: Configuration */}
      <Card
        className={
          !strategyType ? "opacity-50 pointer-events-none" : ""
        }
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </span>
            Configure Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {strategyType && (
            <ConfigForm
              strategyType={strategyType}
              config={config}
              onChange={setConfig}
            />
          )}
        </CardContent>
      </Card>

      <Separator />

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
            !strategyType ||
            createMutation.isPending
          }
        >
          {createMutation.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Create Automation
        </Button>
      </div>
    </div>
  );
}

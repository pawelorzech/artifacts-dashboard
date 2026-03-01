"use client";

import { useState, useEffect } from "react";
import { Settings, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AppSettings {
  apiUrl: string;
  characterRefreshInterval: number;
  automationRefreshInterval: number;
  mapAutoRefresh: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  characterRefreshInterval: 5,
  automationRefreshInterval: 3,
  mapAutoRefresh: true,
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem("artifacts-settings");
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function handleSave() {
    try {
      localStorage.setItem("artifacts-settings", JSON.stringify(settings));
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  }

  function handleReset() {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("artifacts-settings");
    toast.success("Settings reset to defaults");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure dashboard preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="size-4" />
            Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">Backend API URL</Label>
            <Input
              id="api-url"
              value={settings.apiUrl}
              onChange={(e) =>
                setSettings((s) => ({ ...s, apiUrl: e.target.value }))
              }
              placeholder="http://localhost:8000"
            />
            <p className="text-xs text-muted-foreground">
              The URL of the backend API server. Requires page reload to take
              effect.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="size-4" />
            Refresh Intervals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="char-interval">
              Character refresh interval{" "}
              <Badge variant="secondary" className="ml-1">
                seconds
              </Badge>
            </Label>
            <Input
              id="char-interval"
              type="number"
              min={1}
              max={60}
              value={settings.characterRefreshInterval}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  characterRefreshInterval: parseInt(e.target.value, 10) || 5,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-interval">
              Automation status refresh interval{" "}
              <Badge variant="secondary" className="ml-1">
                seconds
              </Badge>
            </Label>
            <Input
              id="auto-interval"
              type="number"
              min={1}
              max={60}
              value={settings.automationRefreshInterval}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  automationRefreshInterval: parseInt(e.target.value, 10) || 3,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex gap-3">
        <Button onClick={handleSave} className="gap-1.5">
          <Save className="size-4" />
          Save Settings
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="size-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}

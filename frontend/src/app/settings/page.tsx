"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Save,
  RotateCcw,
  KeyRound,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";

interface AppSettings {
  characterRefreshInterval: number;
  automationRefreshInterval: number;
  mapAutoRefresh: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
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
  const { status: authStatus, setToken, removeToken } = useAuth();
  const [newToken, setNewToken] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

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

  async function handleSetToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newToken.trim()) return;

    setTokenLoading(true);
    const result = await setToken(newToken.trim());
    setTokenLoading(false);

    if (result.success) {
      setNewToken("");
      toast.success("API token updated");
    } else {
      toast.error(result.error || "Failed to set token");
    }
  }

  async function handleRemoveToken() {
    setTokenLoading(true);
    await removeToken();
    setTokenLoading(false);
    toast.success("API token removed");
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
            <KeyRound className="size-4" />
            API Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {authStatus?.has_token ? (
              <Badge variant="default">
                Connected (
                {authStatus.source === "env"
                  ? "environment"
                  : "user-provided"}
                )
              </Badge>
            ) : (
              <Badge variant="destructive">Not configured</Badge>
            )}
          </div>

          {authStatus?.source !== "env" && (
            <form onSubmit={handleSetToken} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-token">
                  {authStatus?.has_token ? "Replace token" : "Set token"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="new-token"
                    type="password"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="Paste your Artifacts MMO token..."
                    disabled={tokenLoading}
                  />
                  <Button
                    type="submit"
                    disabled={!newToken.trim() || tokenLoading}
                    className="gap-1.5 shrink-0"
                  >
                    {tokenLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}
                    {authStatus?.has_token ? "Update" : "Connect"}
                  </Button>
                </div>
              </div>

              {authStatus?.has_token && authStatus.source === "user" && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveToken}
                  disabled={tokenLoading}
                  className="gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Remove token
                </Button>
              )}
            </form>
          )}

          {authStatus?.source === "env" && (
            <p className="text-xs text-muted-foreground">
              Token is configured via environment variable. To change it,
              update the ARTIFACTS_TOKEN in your .env file and restart the
              backend.
            </p>
          )}
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
                  characterRefreshInterval:
                    parseInt(e.target.value, 10) || 5,
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
                  automationRefreshInterval:
                    parseInt(e.target.value, 10) || 3,
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

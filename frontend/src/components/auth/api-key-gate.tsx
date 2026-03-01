"use client";

import { useState } from "react";
import { KeyRound, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const { status, loading, setToken } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status?.has_token) {
    return <>{children}</>;
  }

  return <ApiKeyForm onSubmit={setToken} />;
}

function ApiKeyForm({
  onSubmit,
}: {
  onSubmit: (token: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;

    setError(null);
    setSubmitting(true);

    const result = await onSubmit(token.trim());
    if (!result.success) {
      setError(result.error || "Failed to set token");
    }

    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Artifacts Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your Artifacts MMO API token to get started.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-token">API Token</Label>
              <Input
                id="api-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token here..."
                disabled={submitting}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!token.trim() || submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Connect
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You can find your token in your{" "}
              <a
                href="https://artifactsmmo.com/account"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5 hover:text-foreground"
              >
                Artifacts MMO account
                <ExternalLink className="size-3" />
              </a>
              . Your token is stored locally in your browser and sent to the
              backend server only.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

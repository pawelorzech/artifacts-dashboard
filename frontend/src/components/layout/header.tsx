"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Swords,
  LayoutDashboard,
  Bot,
  Map,
  Landmark,
  ArrowLeftRight,
  Zap,
  ScrollText,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useConnectionStatus } from "@/components/layout/providers";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Bot,
  Map,
  Landmark,
  ArrowLeftRight,
  Zap,
  ScrollText,
  BarChart3,
};

const STATUS_CONFIG = {
  connected: {
    dotColor: "bg-green-500",
    pingColor: "bg-green-400",
    label: "Connected",
    animate: false,
  },
  connecting: {
    dotColor: "bg-yellow-500",
    pingColor: "bg-yellow-400",
    label: "Connecting...",
    animate: true,
  },
  disconnected: {
    dotColor: "bg-red-500",
    pingColor: "bg-red-400",
    label: "Disconnected",
    animate: false,
  },
} as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const connectionStatus = useConnectionStatus();
  const config = STATUS_CONFIG[connectionStatus];

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="size-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <Swords className="size-5 text-primary" />
              <span>Artifacts</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-2">
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="size-4" />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Mobile title */}
      <div className="flex items-center gap-2 md:hidden">
        <Swords className="size-4 text-primary" />
        <span className="font-semibold text-sm">Artifacts</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection status */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex size-2">
          {config.animate && (
            <span
              className={cn(
                "absolute inline-flex size-full rounded-full opacity-75 animate-ping",
                config.pingColor
              )}
            />
          )}
          {connectionStatus === "connected" && (
            <span
              className={cn(
                "absolute inline-flex size-full rounded-full opacity-75 animate-ping",
                config.pingColor
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-2 rounded-full",
              config.dotColor
            )}
          />
        </span>
        <span className="hidden sm:inline">{config.label}</span>
      </div>
    </header>
  );
}

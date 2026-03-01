"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Swords,
  Pickaxe,
  Hammer,
  TrendingUp,
  ClipboardList,
  GraduationCap,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GALLERY_TEMPLATES,
  GALLERY_CATEGORIES,
  type GalleryTemplate,
  type GalleryCategoryKey,
} from "./gallery-templates";
import { GalleryActivateDialog } from "./gallery-activate-dialog";

const STRATEGY_ICONS: Record<string, typeof Swords> = {
  combat: Swords,
  gathering: Pickaxe,
  crafting: Hammer,
  trading: TrendingUp,
  task: ClipboardList,
  leveling: GraduationCap,
};

const STRATEGY_COLORS: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  combat: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  gathering: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  crafting: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  trading: {
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  task: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  leveling: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/10 text-red-400 border-red-500/30",
};

const CATEGORY_ICONS: Record<string, typeof Swords> = {
  all: Zap,
  combat: Swords,
  gathering: Pickaxe,
  crafting: Hammer,
  trading: TrendingUp,
  utility: ClipboardList,
};

export function AutomationGallery() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<GalleryCategoryKey>("all");
  const [selectedTemplate, setSelectedTemplate] =
    useState<GalleryTemplate | null>(null);

  const filtered = useMemo(() => {
    let result = GALLERY_TEMPLATES;

    if (category !== "all") {
      result = result.filter((t) => t.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }

    return result;
  }, [search, category]);

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search automations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {GALLERY_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.key];
          const isActive = category === cat.key;
          const count =
            cat.key === "all"
              ? GALLERY_TEMPLATES.length
              : GALLERY_TEMPLATES.filter((t) => t.category === cat.key).length;

          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {cat.label}
              <span
                className={cn(
                  "text-xs",
                  isActive
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Search className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            No automations match your search.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const Icon = STRATEGY_ICONS[template.strategy_type] ?? Zap;
            const colors = STRATEGY_COLORS[template.strategy_type] ?? {
              text: "text-muted-foreground",
              bg: "bg-muted",
              border: "border-muted",
            };

            return (
              <Card
                key={template.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md group py-0 overflow-hidden",
                  "hover:border-primary/30"
                )}
                onClick={() => setSelectedTemplate(template)}
              >
                {/* Colored top bar */}
                <div className={cn("h-1", colors.bg.replace("/10", "/40"))} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        colors.bg
                      )}
                    >
                      <Icon className={cn("size-5", colors.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize",
                        DIFFICULTY_COLORS[template.difficulty]
                      )}
                    >
                      {template.difficulty}
                    </Badge>
                    {template.min_level > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        Lv. {template.min_level}+
                      </Badge>
                    )}
                    {template.skill_requirement && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {template.skill_requirement.skill} {template.skill_requirement.level}+
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Activation Dialog */}
      <GalleryActivateDialog
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
      />
    </div>
  );
}

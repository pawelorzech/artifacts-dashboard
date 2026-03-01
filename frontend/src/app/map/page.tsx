"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Minus, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMaps } from "@/hooks/use-game-data";
import { useCharacters } from "@/hooks/use-characters";
import type { MapTile, Character } from "@/lib/types";

const CONTENT_COLORS: Record<string, string> = {
  monster: "#ef4444",
  monsters: "#ef4444",
  resource: "#22c55e",
  resources: "#22c55e",
  bank: "#3b82f6",
  grand_exchange: "#f59e0b",
  workshop: "#a855f7",
  npc: "#06b6d4",
  tasks_master: "#ec4899",
};

const EMPTY_COLOR = "#1f2937";
const CHARACTER_COLOR = "#facc15";
const GRID_LINE_COLOR = "#374151";

const LEGEND_ITEMS = [
  { label: "Monsters", color: "#ef4444", key: "monster" },
  { label: "Resources", color: "#22c55e", key: "resource" },
  { label: "Bank", color: "#3b82f6", key: "bank" },
  { label: "Grand Exchange", color: "#f59e0b", key: "grand_exchange" },
  { label: "Workshop", color: "#a855f7", key: "workshop" },
  { label: "NPC", color: "#06b6d4", key: "npc" },
  { label: "Tasks Master", color: "#ec4899", key: "tasks_master" },
  { label: "Empty", color: "#1f2937", key: "empty" },
  { label: "Character", color: "#facc15", key: "character" },
];

function getTileColor(tile: MapTile): string {
  if (!tile.content?.type) return EMPTY_COLOR;
  return CONTENT_COLORS[tile.content.type] ?? EMPTY_COLOR;
}

interface SelectedTile {
  tile: MapTile;
  characters: Character[];
}

export default function MapPage() {
  const { data: tiles, isLoading, error } = useMaps();
  const { data: characters } = useCharacters();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedTile, setSelectedTile] = useState<SelectedTile | null>(null);

  const [filters, setFilters] = useState<Record<string, boolean>>({
    monster: true,
    resource: true,
    bank: true,
    grand_exchange: true,
    workshop: true,
    npc: true,
    tasks_master: true,
    empty: true,
    character: true,
  });

  // Compute grid bounds
  const bounds = useMemo(() => {
    if (!tiles || tiles.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const tile of tiles) {
      if (tile.x < minX) minX = tile.x;
      if (tile.x > maxX) maxX = tile.x;
      if (tile.y < minY) minY = tile.y;
      if (tile.y > maxY) maxY = tile.y;
    }
    return { minX, maxX, minY, maxY };
  }, [tiles]);

  // Build tile lookup
  const tileMap = useMemo(() => {
    if (!tiles) return new Map<string, MapTile>();
    const map = new Map<string, MapTile>();
    for (const tile of tiles) {
      map.set(`${tile.x},${tile.y}`, tile);
    }
    return map;
  }, [tiles]);

  // Character positions
  const charPositions = useMemo(() => {
    if (!characters) return new Map<string, Character[]>();
    const map = new Map<string, Character[]>();
    for (const char of characters) {
      const key = `${char.x},${char.y}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(char);
    }
    return map;
  }, [characters]);

  const BASE_CELL_SIZE = 18;
  const cellSize = BASE_CELL_SIZE * zoom;

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !tiles || tiles.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;

    const centerOffsetX = (width - gridWidth * cellSize) / 2 + offset.x;
    const centerOffsetY = (height - gridHeight * cellSize) / 2 + offset.y;

    // Draw tiles
    for (const tile of tiles) {
      const contentType = tile.content?.type ?? "empty";
      // Normalize plural to singular for filter check
      const normalizedType = contentType === "monsters" ? "monster" : contentType === "resources" ? "resource" : contentType;

      if (!filters[normalizedType] && normalizedType !== "empty") continue;
      if (normalizedType === "empty" && !filters.empty) continue;

      const px = (tile.x - bounds.minX) * cellSize + centerOffsetX;
      const py = (tile.y - bounds.minY) * cellSize + centerOffsetY;

      // Skip tiles outside visible area
      if (px + cellSize < 0 || py + cellSize < 0 || px > width || py > height)
        continue;

      ctx.fillStyle = getTileColor(tile);
      ctx.fillRect(px, py, cellSize - 1, cellSize - 1);

      // Grid lines when zoomed in
      if (cellSize > 10) {
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, cellSize - 1, cellSize - 1);
      }
    }

    // Draw character markers
    if (filters.character && characters) {
      for (const char of characters) {
        const px =
          (char.x - bounds.minX) * cellSize + centerOffsetX + cellSize / 2;
        const py =
          (char.y - bounds.minY) * cellSize + centerOffsetY + cellSize / 2;

        if (px < -20 || py < -20 || px > width + 20 || py > height + 20)
          continue;

        const radius = Math.max(4, cellSize / 3);

        // Outer glow
        ctx.beginPath();
        ctx.arc(px, py, radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(250, 204, 21, 0.3)";
        ctx.fill();

        // Inner dot
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = CHARACTER_COLOR;
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        if (cellSize >= 14) {
          ctx.fillStyle = "#fff";
          ctx.font = `${Math.max(9, cellSize * 0.5)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(char.name, px, py - radius - 3);
        }
      }
    }
  }, [tiles, characters, bounds, cellSize, offset, filters]);

  useEffect(() => {
    drawMap();
  }, [drawMap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => drawMap());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawMap]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !tiles) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;
    const centerOffsetX = (container.clientWidth - gridWidth * cellSize) / 2 + offset.x;
    const centerOffsetY = (container.clientHeight - gridHeight * cellSize) / 2 + offset.y;

    const tileX = Math.floor((mx - centerOffsetX) / cellSize) + bounds.minX;
    const tileY = Math.floor((my - centerOffsetY) / cellSize) + bounds.minY;

    const key = `${tileX},${tileY}`;
    const tile = tileMap.get(key);

    if (tile) {
      const charsOnTile = charPositions.get(key) ?? [];
      setSelectedTile({ tile, characters: charsOnTile });
    } else {
      setSelectedTile(null);
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUp() {
    setDragging(false);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.3, Math.min(5, z + delta)));
  }

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function toggleFilter(key: string) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          World Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive map of the game world. Click tiles for details, drag to
          pan, scroll to zoom.
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load map data. Make sure the backend is running.
          </p>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {LEGEND_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => toggleFilter(item.key)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-opacity ${
              filters[item.key]
                ? "opacity-100 border-border"
                : "opacity-40 border-border/50"
            }`}
          >
            <span
              className="inline-block size-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-foreground">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Map container */}
      <div className="relative flex gap-4">
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden rounded-lg border border-border bg-slate-950"
          style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}

          <canvas
            ref={canvasRef}
            className={`${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />

          {/* Zoom controls */}
          <div className="absolute right-3 bottom-3 flex flex-col gap-1">
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={() => setZoom((z) => Math.min(5, z + 0.2))}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
            >
              <Minus className="size-4" />
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={resetView}>
              <RotateCcw className="size-4" />
            </Button>
          </div>

          {/* Zoom level indicator */}
          <div className="absolute left-3 bottom-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Side panel */}
        {selectedTile && (
          <Card className="w-72 shrink-0 p-4 space-y-3 self-start">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {selectedTile.tile.name}
              </h3>
              <button
                onClick={() => setSelectedTile(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Close
              </button>
            </div>

            <div className="text-sm text-muted-foreground space-y-1.5">
              <div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
                  Position
                </span>
                <p>
                  ({selectedTile.tile.x}, {selectedTile.tile.y})
                </p>
              </div>

              {selectedTile.tile.content && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
                    Content
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="inline-block size-3 rounded-sm"
                      style={{
                        backgroundColor: getTileColor(selectedTile.tile),
                      }}
                    />
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedTile.tile.content.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-foreground">
                    {selectedTile.tile.content.code}
                  </p>
                </div>
              )}

              {!selectedTile.tile.content && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
                    Content
                  </span>
                  <p className="text-muted-foreground">Empty tile</p>
                </div>
              )}

              {selectedTile.characters.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
                    Characters
                  </span>
                  <div className="flex flex-col gap-1 mt-0.5">
                    {selectedTile.characters.map((char) => (
                      <Badge
                        key={char.name}
                        variant="secondary"
                        className="text-xs w-fit"
                      >
                        {char.name} (Lv. {char.level})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

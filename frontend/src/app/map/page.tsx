"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Plus,
  Minus,
  RotateCcw,
  Search,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useMaps } from "@/hooks/use-game-data";
import { useCharacters } from "@/hooks/use-characters";
import type { MapTile, Character } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
const BASE_CELL_SIZE = 40;
const IMAGE_BASE = "https://artifactsmmo.com/images";

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

const LAYER_OPTIONS = [
  { key: "overworld", label: "Overworld" },
  { key: "underground", label: "Underground" },
  { key: "interior", label: "Interior" },
] as const;

// Content types that have images on the CDN
const IMAGE_CONTENT_TYPES = new Set([
  "monster",
  "monsters",
  "resource",
  "resources",
  "npc",
]);

// ---------------------------------------------------------------------------
// Module-level image cache (persists across re-renders)
// ---------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Note: do NOT set crossOrigin – the CDN doesn't send CORS headers,
    // and we only need to draw the images on canvas (not read pixel data).
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function skinUrl(skin: string): string {
  return `${IMAGE_BASE}/maps/${skin}.png`;
}

function contentIconUrl(type: string, code: string): string {
  const normalizedType = type === "monsters" ? "monster" : type === "resources" ? "resource" : type;
  // CDN path uses plural folder names
  const folder =
    normalizedType === "monster"
      ? "monsters"
      : normalizedType === "resource"
        ? "resources"
        : "npcs";
  return `${IMAGE_BASE}/${folder}/${code}.png`;
}

function getTileColor(tile: MapTile): string {
  if (!tile.content?.type) return EMPTY_COLOR;
  return CONTENT_COLORS[tile.content.type] ?? EMPTY_COLOR;
}

function normalizeContentType(type: string): string {
  if (type === "monsters") return "monster";
  if (type === "resources") return "resource";
  return type;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SelectedTile {
  tile: MapTile;
  characters: Character[];
}

interface SearchResult {
  tile: MapTile;
  label: string;
}

export default function MapPage() {
  const { data: tiles, isLoading, error } = useMaps();
  const { data: characters } = useCharacters();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hoveredKeyRef = useRef<string>("");
  const rafRef = useRef<number>(0);
  const dragDistRef = useRef(0);

  const [zoom, setZoom] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedTile, setSelectedTile] = useState<SelectedTile | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [imageLoadProgress, setImageLoadProgress] = useState({ loaded: 0, total: 0 });
  const [activeLayer, setActiveLayer] = useState("overworld");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

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

  const cellSize = BASE_CELL_SIZE * zoom;

  // ---- Computed data ----

  // Filter tiles by active layer
  const layerTiles = useMemo(() => {
    if (!tiles) return [];
    return tiles.filter((t) => t.layer === activeLayer);
  }, [tiles, activeLayer]);

  const bounds = useMemo(() => {
    if (layerTiles.length === 0)
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const tile of layerTiles) {
      if (tile.x < minX) minX = tile.x;
      if (tile.x > maxX) maxX = tile.x;
      if (tile.y < minY) minY = tile.y;
      if (tile.y > maxY) maxY = tile.y;
    }
    return { minX, maxX, minY, maxY };
  }, [layerTiles]);

  const tileMap = useMemo(() => {
    const map = new Map<string, MapTile>();
    for (const tile of layerTiles) map.set(`${tile.x},${tile.y}`, tile);
    return map;
  }, [layerTiles]);

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

  // ---- Image preloading ----

  useEffect(() => {
    if (!tiles || tiles.length === 0) return;

    const urls = new Set<string>();

    for (const tile of tiles) {
      if (tile.skin) urls.add(skinUrl(tile.skin));
      if (tile.content && IMAGE_CONTENT_TYPES.has(tile.content.type)) {
        urls.add(contentIconUrl(tile.content.type, tile.content.code));
      }
    }

    if (urls.size === 0) {
      setImagesLoaded(true);
      return;
    }

    const total = urls.size;
    let loaded = 0;
    setImageLoadProgress({ loaded: 0, total });

    const promises = [...urls].map((url) =>
      loadImage(url)
        .then(() => {
          loaded++;
          setImageLoadProgress({ loaded, total });
        })
        .catch(() => {
          loaded++;
          setImageLoadProgress({ loaded, total });
        })
    );

    Promise.allSettled(promises).then(() => setImagesLoaded(true));
  }, [tiles]);

  // ---- Canvas drawing ----

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || layerTiles.length === 0) return;

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
    for (const tile of layerTiles) {
      const contentType = tile.content?.type ?? "empty";
      const normalizedType = normalizeContentType(contentType);

      if (!filters[normalizedType] && normalizedType !== "empty") continue;
      if (normalizedType === "empty" && !filters.empty) continue;

      const px = (tile.x - bounds.minX) * cellSize + centerOffsetX;
      const py = (tile.y - bounds.minY) * cellSize + centerOffsetY;

      // Cull off-screen tiles
      if (px + cellSize < 0 || py + cellSize < 0 || px > width || py > height)
        continue;

      // Draw skin image – seamless tiles, no gaps
      const skinImg = tile.skin ? imageCache.get(skinUrl(tile.skin)) : null;

      if (skinImg) {
        ctx.drawImage(skinImg, px, py, cellSize, cellSize);
      } else {
        // Fallback: dark ground color for tiles without skin images
        ctx.fillStyle = EMPTY_COLOR;
        ctx.fillRect(px, py, cellSize, cellSize);
      }

      // Content icon overlay
      if (tile.content) {
        if (IMAGE_CONTENT_TYPES.has(tile.content.type)) {
          const iconImg = imageCache.get(
            contentIconUrl(tile.content.type, tile.content.code)
          );
          if (iconImg) {
            const iconSize = cellSize * 0.6;
            const iconX = px + (cellSize - iconSize) / 2;
            const iconY = py + (cellSize - iconSize) / 2;
            // Drop shadow for icon readability
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 3;
            ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
          }
        } else {
          // For bank/workshop/etc – small colored badge in bottom-right
          const badgeSize = Math.max(6, cellSize * 0.25);
          const badgeX = px + cellSize - badgeSize - 2;
          const badgeY = py + cellSize - badgeSize - 2;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.beginPath();
          ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2 + 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = CONTENT_COLORS[tile.content.type] ?? "#fff";
          ctx.beginPath();
          ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Selected tile highlight – bright outline
      if (
        selectedTile &&
        tile.x === selectedTile.tile.x &&
        tile.y === selectedTile.tile.y
      ) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      }

      // Coordinate text at high zoom – text shadow for readability on tile images
      if (cellSize >= 60) {
        const fontSize = Math.max(8, cellSize * 0.18);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillText(`${tile.x},${tile.y}`, px + 3, py + 3);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(`${tile.x},${tile.y}`, px + 2, py + 2);
      }

      // Tile labels at very high zoom
      if (cellSize >= 80 && (tile.name || tile.content?.code)) {
        const nameSize = Math.max(9, cellSize * 0.16);
        ctx.font = `bold ${nameSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        if (tile.name) {
          // Text with shadow
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillText(tile.name, px + cellSize / 2 + 1, py + cellSize - 1);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillText(tile.name, px + cellSize / 2, py + cellSize - 2);
        }
        if (tile.content?.code) {
          const codeSize = Math.max(8, cellSize * 0.13);
          ctx.font = `${codeSize}px sans-serif`;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillText(
            tile.content.code,
            px + cellSize / 2 + 1,
            py + cellSize - 1 - Math.max(10, cellSize * 0.18)
          );
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.fillText(
            tile.content.code,
            px + cellSize / 2,
            py + cellSize - 2 - Math.max(10, cellSize * 0.18)
          );
        }
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

        // Label with shadow for readability on tile images
        if (cellSize >= 14) {
          const labelFont = `bold ${Math.max(9, cellSize * 0.4)}px sans-serif`;
          ctx.font = labelFont;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillText(char.name, px + 1, py - radius - 2);
          ctx.fillStyle = "#fff";
          ctx.fillText(char.name, px, py - radius - 3);
        }
      }
    }
  }, [layerTiles, characters, bounds, cellSize, offset, filters, selectedTile, imagesLoaded]);

  // ---- Minimap ----

  const drawMinimap = useCallback(() => {
    const minimapCanvas = minimapCanvasRef.current;
    const container = containerRef.current;
    if (!minimapCanvas || !container || layerTiles.length === 0) return;

    const size = 150;
    const dpr = window.devicePixelRatio || 1;
    minimapCanvas.width = size * dpr;
    minimapCanvas.height = size * dpr;
    minimapCanvas.style.width = `${size}px`;
    minimapCanvas.style.height = `${size}px`;

    const ctx = minimapCanvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, size, size);

    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;
    const miniCellW = size / gridWidth;
    const miniCellH = size / gridHeight;

    for (const tile of layerTiles) {
      const mx = (tile.x - bounds.minX) * miniCellW;
      const my = (tile.y - bounds.minY) * miniCellH;

      // Use skin image color or fallback
      ctx.fillStyle = getTileColor(tile);
      if (tile.skin && imageCache.get(skinUrl(tile.skin))) {
        // Approximate dominant color for minimap – just draw the image tiny
        ctx.drawImage(
          imageCache.get(skinUrl(tile.skin))!,
          mx,
          my,
          Math.max(1, miniCellW),
          Math.max(1, miniCellH)
        );
      } else {
        ctx.fillRect(mx, my, Math.max(1, miniCellW), Math.max(1, miniCellH));
      }
    }

    // Character dots
    if (characters) {
      ctx.fillStyle = CHARACTER_COLOR;
      for (const char of characters) {
        const cx = (char.x - bounds.minX) * miniCellW + miniCellW / 2;
        const cy = (char.y - bounds.minY) * miniCellH + miniCellH / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Viewport rectangle
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const mainCenterX = (containerWidth - gridWidth * cellSize) / 2 + offset.x;
    const mainCenterY = (containerHeight - gridHeight * cellSize) / 2 + offset.y;

    // Convert main canvas viewport to grid coordinates
    const viewMinX = -mainCenterX / cellSize;
    const viewMinY = -mainCenterY / cellSize;
    const viewW = containerWidth / cellSize;
    const viewH = containerHeight / cellSize;

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      viewMinX * miniCellW,
      viewMinY * miniCellH,
      viewW * miniCellW,
      viewH * miniCellH
    );
  }, [layerTiles, characters, bounds, cellSize, offset]);

  // ---- RAF draw scheduling ----

  const scheduleDrawRef = useRef<() => void>(null);
  scheduleDrawRef.current = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawMap();
      drawMinimap();
    });
  };

  const scheduleDraw = useCallback(() => {
    scheduleDrawRef.current?.();
  }, []);

  useEffect(() => {
    scheduleDraw();
  }, [drawMap, drawMinimap, scheduleDraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => scheduleDraw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [scheduleDraw]);

  // ---- Search ----

  useEffect(() => {
    if (!searchQuery.trim() || layerTiles.length === 0) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.trim().toLowerCase();

    // Try coordinate parse: "3, -5" or "3 -5"
    const coordMatch = q.match(/^(-?\d+)[,\s]+(-?\d+)$/);
    if (coordMatch) {
      const cx = parseInt(coordMatch[1]);
      const cy = parseInt(coordMatch[2]);
      const tile = tileMap.get(`${cx},${cy}`);
      if (tile) {
        setSearchResults([
          { tile, label: `(${cx}, ${cy}) ${tile.name || "Unknown"}` },
        ]);
      } else {
        setSearchResults([]);
      }
      return;
    }

    // Text search on name and content code
    const results: SearchResult[] = [];
    for (const tile of layerTiles) {
      if (results.length >= 20) break;
      const nameMatch = tile.name?.toLowerCase().includes(q);
      const codeMatch = tile.content?.code?.toLowerCase().includes(q);
      if (nameMatch || codeMatch) {
        results.push({
          tile,
          label: `(${tile.x}, ${tile.y}) ${tile.name || tile.content?.code || "Unknown"}`,
        });
      }
    }
    setSearchResults(results);
  }, [searchQuery, layerTiles, tileMap]);

  function jumpToTile(tile: MapTile) {
    const container = containerRef.current;
    if (!container) return;

    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Center the tile in view
    const tilePxX = (tile.x - bounds.minX) * cellSize + cellSize / 2;
    const tilePxY = (tile.y - bounds.minY) * cellSize + cellSize / 2;
    const gridOriginX = (containerWidth - gridWidth * cellSize) / 2;
    const gridOriginY = (containerHeight - gridHeight * cellSize) / 2;

    setOffset({
      x: containerWidth / 2 - gridOriginX - tilePxX,
      y: containerHeight / 2 - gridOriginY - tilePxY,
    });

    const charsOnTile = charPositions.get(`${tile.x},${tile.y}`) ?? [];
    setSelectedTile({ tile, characters: charsOnTile });
    setSearchOpen(false);
    setSearchQuery("");
  }

  // ---- Mouse events ----

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // Ignore clicks after dragging
    if (dragDistRef.current > 5) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || layerTiles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;
    const centerOffsetX =
      (container.clientWidth - gridWidth * cellSize) / 2 + offset.x;
    const centerOffsetY =
      (container.clientHeight - gridHeight * cellSize) / 2 + offset.y;

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
    dragDistRef.current = 0;
  }

  function handleMouseMove(e: React.MouseEvent) {
    // Tooltip handling
    updateTooltip(e);

    if (!dragging) return;

    const dx = e.clientX - dragStart.x - offset.x;
    const dy = e.clientY - dragStart.y - offset.y;
    dragDistRef.current += Math.abs(dx) + Math.abs(dy);

    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUp() {
    setDragging(false);
  }

  function handleMouseLeave() {
    setDragging(false);
    if (tooltipRef.current) {
      tooltipRef.current.style.display = "none";
    }
    hoveredKeyRef.current = "";
  }

  function updateTooltip(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !container || !tooltip || layerTiles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;
    const centerOffsetX =
      (container.clientWidth - gridWidth * cellSize) / 2 + offset.x;
    const centerOffsetY =
      (container.clientHeight - gridHeight * cellSize) / 2 + offset.y;

    const tileX = Math.floor((mx - centerOffsetX) / cellSize) + bounds.minX;
    const tileY = Math.floor((my - centerOffsetY) / cellSize) + bounds.minY;
    const key = `${tileX},${tileY}`;

    // Skip re-render if same tile
    if (key === hoveredKeyRef.current) {
      tooltip.style.left = `${e.clientX - rect.left + 12}px`;
      tooltip.style.top = `${e.clientY - rect.top + 12}px`;
      return;
    }

    hoveredKeyRef.current = key;
    const tile = tileMap.get(key);

    if (!tile) {
      tooltip.style.display = "none";
      return;
    }

    const charsOnTile = charPositions.get(key);
    let html = `<div class="font-semibold">${tile.name || "Unknown"}</div>`;
    html += `<div class="text-xs text-gray-400">(${tile.x}, ${tile.y})</div>`;
    if (tile.content) {
      html += `<div class="text-xs mt-1"><span class="capitalize">${tile.content.type}</span>: ${tile.content.code}</div>`;
    }
    if (charsOnTile && charsOnTile.length > 0) {
      html += `<div class="text-xs mt-1 text-yellow-400">${charsOnTile.map((c) => c.name).join(", ")}</div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    tooltip.style.left = `${e.clientX - rect.left + 12}px`;
    tooltip.style.top = `${e.clientY - rect.top + 12}px`;
  }

  // ---- Zoom toward cursor ----

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * factor));
    const scale = newZoom / zoom;

    // Adjust offset so the point under cursor stays fixed
    setOffset((prev) => ({
      x: mouseX - scale * (mouseX - prev.x),
      y: mouseY - scale * (mouseY - prev.y),
    }));
    setZoom(newZoom);
  }

  function resetView() {
    setZoom(0.5);
    setOffset({ x: 0, y: 0 });
  }

  function toggleFilter(key: string) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === "Escape") {
          setSearchOpen(false);
          setSearchQuery("");
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          setZoom((z) => Math.min(5, z * 1.15));
          break;
        case "-":
          e.preventDefault();
          setZoom((z) => Math.max(0.1, z * 0.87));
          break;
        case "0":
          e.preventDefault();
          resetView();
          break;
        case "Escape":
          setSelectedTile(null);
          setSearchOpen(false);
          setSearchQuery("");
          break;
        case "/":
          e.preventDefault();
          setSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 0);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ---- Render ----

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            World Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interactive map of the game world. Click tiles for details, drag to
            pan, scroll to zoom. Press{" "}
            <kbd className="px-1 py-0.5 text-xs border rounded bg-muted">
              /
            </kbd>{" "}
            to search.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder='Search tiles or "x, y"...'
              className="pl-9 h-9"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
            />
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map((r) => (
                <button
                  key={`${r.tile.x},${r.tile.y}`}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={() => jumpToTile(r.tile)}
                >
                  <span
                    className="inline-block size-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: getTileColor(r.tile) }}
                  />
                  <span className="text-foreground truncate">{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load map data. Make sure the backend is running.
          </p>
        </Card>
      )}

      {/* Layer selector + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <Layers className="size-4 text-muted-foreground" />
          {LAYER_OPTIONS.map((layer) => (
            <button
              key={layer.key}
              onClick={() => setActiveLayer(layer.key)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                activeLayer === layer.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
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

          {/* Image loading progress */}
          {!imagesLoaded && imageLoadProgress.total > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 z-10">
              <div className="text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading map images... {imageLoadProgress.loaded}/
                  {imageLoadProgress.total}
                </p>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className={`${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
          />

          {/* Hover tooltip */}
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none z-20 bg-popover/95 border border-border rounded-md px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm"
            style={{ display: "none" }}
          />

          {/* Minimap */}
          <canvas
            ref={minimapCanvasRef}
            className="absolute top-3 right-3 rounded border border-border/50 bg-slate-950/80"
            style={{ width: 150, height: 150 }}
          />

          {/* Zoom controls */}
          <div className="absolute right-3 bottom-3 flex flex-col gap-1">
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={() => setZoom((z) => Math.min(5, z * 1.2))}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={() => setZoom((z) => Math.max(0.1, z * 0.83))}
            >
              <Minus className="size-4" />
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={resetView}>
              <RotateCcw className="size-4" />
            </Button>
          </div>

          {/* Coordinate display + zoom level */}
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

            {/* Tile skin image */}
            {selectedTile.tile.skin && (
              <div className="rounded overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={skinUrl(selectedTile.tile.skin)}
                  alt={selectedTile.tile.name}
                  className="w-full h-auto"
                />
              </div>
            )}

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

                  {/* Content icon image */}
                  {IMAGE_CONTENT_TYPES.has(selectedTile.tile.content.type) && (
                    <div className="mt-2 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={contentIconUrl(
                          selectedTile.tile.content.type,
                          selectedTile.tile.content.code
                        )}
                        alt={selectedTile.tile.content.code}
                        className="size-16 object-contain"
                      />
                    </div>
                  )}
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

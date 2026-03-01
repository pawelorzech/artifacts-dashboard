"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { PricePoint } from "@/lib/types";
import { Card } from "@/components/ui/card";

interface PriceChartProps {
  data: PricePoint[];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <Card className="p-3 border border-border bg-background/95 backdrop-blur-sm shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">{formatDate(label)}</p>
      {payload.map((entry: TooltipPayloadItem) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function PriceChart({ data }: PriceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No price data available for this item.
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    time: point.captured_at,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#374151"
          opacity={0.3}
        />
        <XAxis
          dataKey="time"
          tickFormatter={formatTime}
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          stroke="#4b5563"
        />
        <YAxis
          yAxisId="price"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          stroke="#4b5563"
          domain={["auto", "auto"]}
        />
        <YAxis
          yAxisId="volume"
          orientation="right"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          stroke="#4b5563"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
        />
        <Bar
          yAxisId="volume"
          dataKey="volume"
          name="Volume"
          fill="#6366f1"
          opacity={0.2}
          barSize={12}
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="buy_price"
          name="Buy Price"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#22c55e" }}
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="sell_price"
          name="Sell Price"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#ef4444" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

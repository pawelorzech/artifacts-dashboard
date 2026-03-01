"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Loader2,
  Activity,
  Coins,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useCharacters } from "@/hooks/use-characters";
import { useAnalytics } from "@/hooks/use-analytics";
import { SKILLS, SKILL_COLOR_TEXT_MAP } from "@/lib/constants";
import type { Character } from "@/lib/types";

const TIME_RANGES = [
  { label: "Last 1h", hours: 1 },
  { label: "Last 6h", hours: 6 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
] as const;

const SKILL_CHART_COLORS = [
  "#f59e0b", // amber
  "#22c55e", // green
  "#3b82f6", // blue
  "#ef4444", // red
  "#64748b", // slate
  "#a855f7", // purple
  "#f97316", // orange
  "#10b981", // emerald
];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ChartTooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <Card className="p-3 border border-border bg-background/95 backdrop-blur-sm shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {payload.map((entry: ChartTooltipPayloadItem) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground tabular-nums">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </Card>
  );
}

function SkillLevelChart({ character }: { character: Character }) {
  const skillData = SKILLS.map((skill, idx) => ({
    skill: skill.label,
    level: character[`${skill.key}_level` as keyof Character] as number,
    fill: SKILL_CHART_COLORS[idx],
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={skillData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="skill"
          tick={{ fill: "#9ca3af", fontSize: 10 }}
          stroke="#4b5563"
          angle={-35}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} stroke="#4b5563" />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="level" name="Level" radius={[4, 4, 0, 0]}>
          {skillData.map((entry, index) => (
            <rect key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AnalyticsPage() {
  const { data: characters, isLoading: loadingChars } = useCharacters();
  const [selectedChar, setSelectedChar] = useState("_all");
  const [timeRange, setTimeRange] = useState<number>(24);

  const characterName =
    selectedChar === "_all" ? undefined : selectedChar;
  const {
    data: analytics,
    isLoading: loadingAnalytics,
    error,
  } = useAnalytics(characterName, timeRange);

  const selectedCharacter = useMemo(() => {
    if (!characters || selectedChar === "_all") return null;
    return characters.find((c) => c.name === selectedChar) ?? null;
  }, [characters, selectedChar]);

  const xpChartData = useMemo(() => {
    if (!analytics?.xp_history) return [];
    return analytics.xp_history.map((point) => ({
      time: formatTime(point.timestamp),
      xp: point.value,
      label: point.label ?? "XP",
    }));
  }, [analytics]);

  const goldChartData = useMemo(() => {
    if (!analytics?.gold_history) return [];
    return analytics.gold_history.map((point) => ({
      time: formatTime(point.timestamp),
      gold: point.value,
    }));
  }, [analytics]);

  const isLoading = loadingChars || loadingAnalytics;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track XP gains, gold progression, and activity metrics
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load analytics. Make sure the backend is running.
          </p>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedChar} onValueChange={setSelectedChar}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Characters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Characters</SelectItem>
            {characters?.map((char) => (
              <SelectItem key={char.name} value={char.name}>
                {char.name} (Lv. {char.level})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.hours}
              onClick={() => setTimeRange(range.hours)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                timeRange === range.hours
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {analytics && (
        <>
          {/* Stats Card */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Zap className="size-4 text-amber-400" />
                  Actions / Hour
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {analytics.actions_per_hour.toFixed(1)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-blue-400" />
                  XP Data Points
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {analytics.xp_history.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Coins className="size-4 text-amber-400" />
                  Gold Data Points
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {analytics.gold_history.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* XP Gain Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-5 text-blue-400" />
                XP Gain Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {xpChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={xpChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#374151"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      stroke="#4b5563"
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      stroke="#4b5563"
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="xp"
                      name="XP"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#3b82f6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  No XP data available for the selected time range.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gold Tracking Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="size-5 text-amber-400" />
                Gold Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {goldChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={goldChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="goldGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#374151"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      stroke="#4b5563"
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      stroke="#4b5563"
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="gold"
                      name="Gold"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#goldGradient)"
                      activeDot={{ r: 4, fill: "#f59e0b" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  No gold data available for the selected time range.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Level Progression */}
          {selectedCharacter && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-5 text-purple-400" />
                  Skill Levels - {selectedCharacter.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SkillLevelChart character={selectedCharacter} />

                {/* Skill badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {SKILLS.map((skill) => {
                    const level = selectedCharacter[
                      `${skill.key}_level` as keyof Character
                    ] as number;
                    return (
                      <Badge
                        key={skill.key}
                        variant="outline"
                        className="text-xs gap-1.5"
                      >
                        <span className={SKILL_COLOR_TEXT_MAP[skill.color]}>
                          {skill.label}
                        </span>
                        <span className="text-foreground font-semibold tabular-nums">
                          {level}
                        </span>
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {!selectedCharacter && characters && characters.length > 0 && (
            <Card className="p-6 text-center">
              <BarChart3 className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Select a specific character above to view skill level
                progression.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Empty state when no analytics */}
      {!analytics && !isLoading && !error && (
        <Card className="p-8 text-center">
          <BarChart3 className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No analytics data available yet. Start automations or perform
            actions to generate data.
          </p>
        </Card>
      )}
    </div>
  );
}

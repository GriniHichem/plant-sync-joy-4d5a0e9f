import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { GripVertical, Filter, RefreshCw, Settings2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartPoint, KpiData, LayoutItem, TableData, WidgetStyle } from "@/lib/direction/widgetCatalog";
import { WIDGET_MAP } from "@/lib/direction/widgetCatalog";
import { resolveCtx, type DashboardFilters } from "@/lib/direction/filters";

const ACCENTS: Record<NonNullable<WidgetStyle["accent"]>, string> = {
  primary: "hsl(var(--primary))",
  blue: "hsl(217 91% 55%)",
  emerald: "hsl(160 84% 34%)",
  amber: "hsl(38 92% 48%)",
  violet: "hsl(263 70% 58%)",
  rose: "hsl(348 83% 55%)",
  cyan: "hsl(190 90% 40%)",
};

export const ACCENT_KEYS = Object.keys(ACCENTS) as (keyof typeof ACCENTS)[];

const paletteFor = (accent: string) => [
  accent,
  "hsl(217 91% 60%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(263 70% 60%)",
  "hsl(348 83% 60%)",
  "hsl(190 90% 42%)",
];

interface Props {
  item: LayoutItem;
  globalFilters: DashboardFilters;
  refreshSeconds: number;
  editing?: boolean;
  onRemove?: () => void;
  onConfigure?: () => void;
}

export function DirectionWidget({ item, globalFilters, refreshSeconds, editing, onRemove, onConfigure }: Props) {
  const def = WIDGET_MAP.get(item.widgetId);
  const style = item.style ?? {};
  const accent = ACCENTS[style.accent ?? "primary"];

  const ctx = useMemo(() => resolveCtx(globalFilters, item.filters), [globalFilters, item.filters]);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["direction_widget", item.widgetId, ctx],
    enabled: !!def,
    staleTime: 30_000,
    // Évite les rafraîchissements intempestifs pendant la composition.
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    refetchInterval: refreshSeconds > 0 ? refreshSeconds * 1000 : false,
    queryFn: () => def!.fetch(ctx),
  });

  if (!def) {
    return (
      <Card className="h-full">
        <CardContent className="p-4 text-sm text-muted-foreground">Widget inconnu ({item.widgetId})</CardContent>
      </Card>
    );
  }

  const title = item.title?.trim() || def.title;
  const isLocal = item.filters?.useGlobal === false;
  const compact = style.density === "compact";

  return (
    <Card className="h-full flex flex-col overflow-hidden" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
      <CardHeader className={cn("flex-row items-center gap-2 space-y-0 border-b bg-muted/30 px-3", compact ? "py-1.5" : "py-2")}>
        {editing && <GripVertical className="drag-handle h-4 w-4 shrink-0 cursor-move text-muted-foreground" />}
        <CardTitle className="text-sm font-semibold truncate flex-1">{title}</CardTitle>
        {isLocal && (
          <Badge variant="outline" className="shrink-0 gap-1 text-[10px]"><Filter className="h-2.5 w-2.5" />local</Badge>
        )}
        {def.supportsPeriod && !compact && (
          <Badge variant="outline" className="shrink-0 text-[10px]">{ctx.label}</Badge>
        )}
        {editing ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onConfigure} title="Configurer">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={onRemove} title="Retirer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => refetch()} title="Actualiser">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        )}
      </CardHeader>
      <CardContent className={cn("flex-1 min-h-0 overflow-auto", compact ? "p-2" : "p-3")}>
        {isLoading ? (
          <Skeleton className="h-full w-full min-h-[60px]" />
        ) : error ? (
          <p className="text-xs text-muted-foreground">Données indisponibles (droits insuffisants ou source vide).</p>
        ) : def.kind === "kpi" ? (
          <KpiView data={data as KpiData} accent={accent} style={style} />
        ) : def.kind === "chart" ? (
          <ChartView kind={def.chart ?? "bar"} data={(data as ChartPoint[]) ?? []} accent={accent} />
        ) : (
          <TableView data={data as TableData} compact={compact} />
        )}
      </CardContent>
    </Card>
  );
}

function KpiView({ data, accent, style }: { data?: KpiData; accent: string; style: WidgetStyle }) {
  if (!data) return null;
  const size = style.fontScale === "lg" ? "text-4xl" : style.fontScale === "sm" ? "text-2xl" : "text-3xl";
  const num = typeof data.value === "number" ? data.value : null;
  const delta =
    num != null && data.previous != null && data.previous !== 0
      ? Math.round(((num - data.previous) / Math.abs(data.previous)) * 1000) / 10
      : null;
  const good = delta == null ? null : data.higherIsBetter === false ? delta <= 0 : delta >= 0;

  return (
    <div className="h-full flex flex-col justify-center">
      <div className={cn("font-bold tabular-nums leading-none", size)} style={{ color: accent }}>
        {typeof data.value === "number" ? data.value.toLocaleString("fr-FR") : data.value}
        {data.unit && <span className="text-base font-medium text-muted-foreground ml-1">{data.unit}</span>}
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {delta != null && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-emerald-600" : "text-destructive")}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}{delta} %
          </span>
        )}
        {data.previous != null && (
          <span className="text-[11px] text-muted-foreground">
            période préc. : {data.previous.toLocaleString("fr-FR")}
          </span>
        )}
      </div>
      {data.hint && <p className="text-xs text-muted-foreground mt-1">{data.hint}</p>}
    </div>
  );
}

function ChartView({ kind, data, accent }: { kind: string; data: ChartPoint[]; accent: string }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">Aucune donnée sur la période.</p>;
  const colors = paletteFor(accent);
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={140}>
      {kind === "pie" ? (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" outerRadius="75%" label>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip />
        </PieChart>
      ) : kind === "line" ? (
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} />
        </LineChart>
      ) : kind === "area" ? (
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={2} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={44} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

function TableView({ data, compact }: { data?: TableData; compact?: boolean }) {
  if (!data || data.rows.length === 0)
    return <p className="text-xs text-muted-foreground">Aucune ligne à afficher.</p>;
  return (
    <Table>
      <TableHeader className="sticky top-0 bg-card z-10">
        <TableRow>
          {data.columns.map((c) => (
            <TableHead key={c.key} className="h-8 text-xs whitespace-nowrap">{c.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((r, i) => (
          <TableRow key={i} className="even:bg-muted/30">
            {data.columns.map((c) => (
              <TableCell key={c.key} className={cn("text-xs whitespace-nowrap", compact ? "py-1" : "py-1.5")}>
                {r[c.key] ?? "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

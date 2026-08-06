import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DashboardWidget,
  KpiResult,
  MODULE_ACCENT,
  ResolvedPeriod,
  SeriePoint,
  TableResult,
  WIDGETS_BY_ID,
  WidgetCtx,
  WidgetFilters,
  previousPeriod,
  resolvePeriod,
} from "@/lib/directionWidgets";

const HEIGHTS: Record<DashboardWidget["h"], string> = {
  sm: "h-[150px]",
  md: "h-[250px]",
  lg: "h-[360px]",
};

export const ACCENTS: Record<string, string> = {
  primary: "hsl(var(--primary))",
  chart2: "hsl(var(--chart-2, 173 58% 39%))",
  chart3: "hsl(var(--chart-3, 197 37% 24%))",
  chart4: "hsl(var(--chart-4, 43 74% 66%))",
  chart5: "hsl(var(--chart-5, 27 87% 67%))",
  destructive: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = [
  ACCENTS.primary,
  ACCENTS.chart2,
  ACCENTS.chart3,
  ACCENTS.chart4,
  ACCENTS.chart5,
  ACCENTS.muted,
];

interface Props {
  item: DashboardWidget;
  globalPeriod: ResolvedPeriod;
  globalFilters: WidgetFilters;
  globalCompare: boolean;
  refreshSeconds: number;
  toolbar?: React.ReactNode;
}

export function WidgetCard({
  item,
  globalPeriod,
  globalFilters,
  globalCompare,
  refreshSeconds,
  toolbar,
}: Props) {
  const def = WIDGETS_BY_ID.get(item.widgetId);

  const period = item.period
    ? resolvePeriod(item.period, item.customFrom, item.customTo)
    : globalPeriod;
  const filters: WidgetFilters =
    item.useGlobalFilters === false ? item.filters ?? {} : { ...globalFilters, ...(item.filters ?? {}) };

  const supported = def?.filters ?? [];
  const ctx: WidgetCtx = {
    from: period.from,
    to: period.to,
    days: period.days,
    lineId: supported.includes("line") ? filters.lineId ?? null : null,
    productId: supported.includes("product") ? filters.productId ?? null : null,
    supplierId: supported.includes("supplier") ? filters.supplierId ?? null : null,
    campaignId: supported.includes("campaign") ? filters.campaignId ?? null : null,
  };

  const compare = !!(item.compare ?? globalCompare) && def?.kind === "kpi";
  const keyBase = [
    "direction_widget",
    item.widgetId,
    period.from.toISOString(),
    period.to.toISOString(),
    ctx.lineId,
    ctx.productId,
    ctx.supplierId,
    ctx.campaignId,
  ];

  const { data, isLoading, isError } = useQuery({
    enabled: !!def,
    queryKey: keyBase,
    queryFn: () => def!.fetch(ctx),
    refetchInterval: refreshSeconds > 0 ? refreshSeconds * 1000 : false,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const prev = previousPeriod(period);
  const { data: prevData } = useQuery({
    enabled: !!def && compare,
    queryKey: [...keyBase, "prev"],
    queryFn: () => def!.fetch({ ...ctx, from: prev.from, to: prev.to, days: prev.days }),
    staleTime: 60_000,
  });

  const accent = ACCENTS[item.accent ?? (def ? MODULE_ACCENT[def.module] : "primary")] ?? ACCENTS.primary;

  if (!def) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Widget introuvable ({item.widgetId})
        </CardContent>
      </Card>
    );
  }

  const body = () => {
    if (isLoading && data === undefined) return <Skeleton className="h-full w-full" />;
    if (isError || data === undefined)
      return <p className="text-sm text-destructive">Données indisponibles</p>;

    if (def.kind === "kpi") {
      const k = data as KpiResult;
      const p = prevData as KpiResult | undefined;
      const delta =
        compare && p && typeof p.raw === "number" && p.raw !== 0 && typeof k.raw === "number"
          ? ((k.raw - p.raw) / Math.abs(p.raw)) * 100
          : null;
      const Icon = delta === null ? ArrowRight : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;
      return (
        <div
          className={cn(
            "flex h-full flex-col justify-center",
            item.align === "center" && "items-center text-center",
          )}
        >
          <p
            className={cn(
              "font-bold tabular-nums",
              item.emphasis === "large" ? "text-4xl" : "text-3xl",
            )}
            style={{ color: accent }}
          >
            {k.value}
          </p>
          {k.subtitle && <p className="mt-1 text-xs text-muted-foreground">{k.subtitle}</p>}
          {delta !== null && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {delta > 0 ? "+" : ""}
              {Math.round(delta * 10) / 10} % vs période précédente
            </p>
          )}
        </div>
      );
    }

    if (def.kind === "table") {
      const t = data as TableResult;
      if (!t.rows.length) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;
      return (
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {t.columns.map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap text-xs">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.rows.map((r, i) => (
                <TableRow key={i}>
                  {t.columns.map((c) => (
                    <TableCell key={c.key} className="whitespace-nowrap text-xs">
                      {r[c.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    const serie = data as SeriePoint[];
    if (!serie.length) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;

    if (def.kind === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={serie} dataKey="value" nameKey="label" outerRadius="75%">
              {serie.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    const hasSecond = serie.some((p) => p.value2 !== undefined);

    if (def.kind === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip />
            <Bar dataKey="value" fill={accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={serie}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} />
          {hasSecond && (
            <Line
              type="monotone"
              dataKey="value2"
              stroke={ACCENTS.destructive}
              strokeWidth={2}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const localMarks = [
    item.period ? "période locale" : null,
    item.useGlobalFilters === false ? "filtres locaux" : null,
  ].filter(Boolean);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-3 pb-1">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm">{item.title || def.title}</CardTitle>
          <p className="truncate text-[11px] text-muted-foreground">
            {def.module} · {period.label}
            {localMarks.length ? ` · ${localMarks.join(" · ")}` : ""}
          </p>
        </div>
        {toolbar}
      </CardHeader>
      <CardContent className={cn("p-3 pt-1", HEIGHTS[item.h])}>{body()}</CardContent>
    </Card>
  );
}

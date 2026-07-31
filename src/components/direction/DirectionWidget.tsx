import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { GripVertical, RefreshCw, Settings2, Trash2 } from "lucide-react";
import type { ChartPoint, KpiData, LayoutItem, TableData } from "@/lib/direction/widgetCatalog";
import { WIDGET_MAP } from "@/lib/direction/widgetCatalog";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, var(--muted-foreground)))",
  "hsl(var(--destructive))",
  "hsl(var(--warning, var(--primary)))",
  "hsl(var(--accent-foreground))",
  "hsl(var(--secondary-foreground))",
];

interface Props {
  item: LayoutItem;
  refreshSeconds: number;
  editing?: boolean;
  onRemove?: () => void;
  onConfigure?: () => void;
}

export function DirectionWidget({ item, refreshSeconds, editing, onRemove, onConfigure }: Props) {
  const def = WIDGET_MAP.get(item.widgetId);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["direction_widget", item.widgetId, item.filters ?? {}],
    enabled: !!def,
    staleTime: 30_000,
    refetchInterval: refreshSeconds > 0 ? refreshSeconds * 1000 : false,
    queryFn: () => def!.fetch(item.filters ?? {}),
  });

  if (!def) {
    return (
      <Card className="h-full">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Widget inconnu ({item.widgetId})
        </CardContent>
      </Card>
    );
  }

  const title = item.title?.trim() || def.title;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="py-2 px-3 flex-row items-center gap-2 space-y-0 border-b bg-muted/30">
        {editing && <GripVertical className="drag-handle h-4 w-4 shrink-0 cursor-move text-muted-foreground" />}
        <CardTitle className="text-sm font-semibold truncate flex-1">{title}</CardTitle>
        {item.filters?.days && (
          <Badge variant="outline" className="shrink-0 text-[10px]">{item.filters.days} j</Badge>
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
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 overflow-auto">
        {isLoading ? (
          <Skeleton className="h-full w-full min-h-[60px]" />
        ) : error ? (
          <p className="text-xs text-muted-foreground">Données indisponibles (droits insuffisants ou source vide).</p>
        ) : def.kind === "kpi" ? (
          <KpiView data={data as KpiData} />
        ) : def.kind === "chart" ? (
          <ChartView kind={def.chart ?? "bar"} data={(data as ChartPoint[]) ?? []} />
        ) : (
          <TableView data={data as TableData} />
        )}
      </CardContent>
    </Card>
  );
}

function KpiView({ data }: { data?: KpiData }) {
  if (!data) return null;
  return (
    <div className="h-full flex flex-col justify-center">
      <div className="text-3xl font-bold tabular-nums leading-none">
        {data.value}
        {data.unit && <span className="text-base font-medium text-muted-foreground ml-1">{data.unit}</span>}
      </div>
      {data.hint && <p className="text-xs text-muted-foreground mt-1.5">{data.hint}</p>}
    </div>
  );
}

function ChartView({ kind, data }: { kind: string; data: ChartPoint[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">Aucune donnée sur la période.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={140}>
      {kind === "pie" ? (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" outerRadius="75%" label>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
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
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={44} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

function TableView({ data }: { data?: TableData }) {
  if (!data || data.rows.length === 0)
    return <p className="text-xs text-muted-foreground">Aucune ligne à afficher.</p>;
  return (
    <Table>
      <TableHeader>
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
              <TableCell key={c.key} className="py-1.5 text-xs whitespace-nowrap">{r[c.key] ?? "—"}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

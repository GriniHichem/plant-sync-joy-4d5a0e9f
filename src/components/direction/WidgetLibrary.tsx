import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, LineChart, PieChart, Table2, Gauge, Plus, Search } from "lucide-react";
import { MODULE_ACCENT, WIDGETS, WIDGET_MODULES, WidgetDef } from "@/lib/directionWidgets";
import { ACCENTS } from "@/components/direction/WidgetCard";
import { usePermissions } from "@/hooks/usePermissions";

const KIND_ICON = {
  kpi: Gauge,
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  table: Table2,
} as const;

const KIND_LABEL = {
  kpi: "KPI",
  bar: "Barres",
  line: "Courbe",
  pie: "Répartition",
  table: "Tableau",
} as const;

function useWidgetList(q: string, mod: string | null, kind: string | null) {
  const { canView, loading } = usePermissions();
  return useMemo(() => {
    const term = q.trim().toLowerCase();
    return WIDGETS.filter((w) => (loading ? true : canView(w.permission)))
      .filter((w) => !mod || w.module === mod)
      .filter((w) => !kind || w.kind === kind)
      .filter(
        (w) =>
          !term ||
          w.title.toLowerCase().includes(term) ||
          w.description.toLowerCase().includes(term) ||
          w.module.toLowerCase().includes(term),
      );
  }, [q, mod, kind, canView, loading]);
}

function WidgetRow({ w, onAdd }: { w: WidgetDef; onAdd: (d: WidgetDef) => void }) {
  const Icon = KIND_ICON[w.kind];
  const color = ACCENTS[MODULE_ACCENT[w.module]] ?? ACCENTS.primary;
  return (
    <button
      onClick={() => onAdd(w)}
      className="group flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors hover:border-primary hover:bg-accent"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{w.title}</span>
        <span className="line-clamp-2 block text-xs text-muted-foreground">{w.description}</span>
        <span className="mt-1 inline-flex gap-1">
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {w.module}
          </Badge>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {KIND_LABEL[w.kind]}
          </Badge>
        </span>
      </span>
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
    </button>
  );
}

function Filters({
  q,
  setQ,
  mod,
  setMod,
  kind,
  setKind,
}: {
  q: string;
  setQ: (v: string) => void;
  mod: string | null;
  setMod: (v: string | null) => void;
  kind: string | null;
  setKind: (v: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Rechercher un composant…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge
          variant={mod === null ? "default" : "outline"}
          className="cursor-pointer text-[10px]"
          onClick={() => setMod(null)}
        >
          Tous
        </Badge>
        {WIDGET_MODULES.map((m) => (
          <Badge
            key={m}
            variant={mod === m ? "default" : "outline"}
            className="cursor-pointer text-[10px]"
            onClick={() => setMod(mod === m ? null : m)}
          >
            {m}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
          <Badge
            key={k}
            variant={kind === k ? "default" : "secondary"}
            className="cursor-pointer text-[10px]"
            onClick={() => setKind(kind === k ? null : k)}
          >
            {KIND_LABEL[k]}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Panneau latéral persistant (desktop) */
export function WidgetLibraryPanel({ onAdd }: { onAdd: (d: WidgetDef) => void }) {
  const [q, setQ] = useState("");
  const [mod, setMod] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const list = useWidgetList(q, mod, kind);

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card p-3">
      <div>
        <p className="text-sm font-semibold">Bibliothèque de composants</p>
        <p className="text-xs text-muted-foreground">{list.length} composants disponibles</p>
      </div>
      <Filters q={q} setQ={setQ} mod={mod} setMod={setMod} kind={kind} setKind={setKind} />
      <ScrollArea className="h-[calc(100vh-22rem)] pr-2">
        <div className="space-y-2">
          {list.map((w) => (
            <WidgetRow key={w.id} w={w} onAdd={onAdd} />
          ))}
          {!list.length && (
            <p className="p-4 text-sm text-muted-foreground">Aucun composant disponible.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (def: WidgetDef) => void;
}

/** Dialog (mobile / tablette) */
export function WidgetLibrary({ open, onOpenChange, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [mod, setMod] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const list = useWidgetList(q, mod, kind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Bibliothèque de composants</DialogTitle>
        </DialogHeader>

        <Filters q={q} setQ={setQ} mod={mod} setMod={setMod} kind={kind} setKind={setKind} />

        <ScrollArea className="h-[55vh] pr-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((w) => (
              <WidgetRow key={w.id} w={w} onAdd={onAdd} />
            ))}
            {!list.length && (
              <p className="p-4 text-sm text-muted-foreground">Aucun composant disponible.</p>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

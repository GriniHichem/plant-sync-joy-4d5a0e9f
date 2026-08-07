import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, RotateCcw, Columns3, Image as ImageIcon, LayoutGrid, TableIcon, Upload, Trash2, Wrench, Ticket as TicketIcon, CheckCircle2, Hourglass, Package, Scale, TrendingDown, Percent, CalendarDays, Timer, SlidersHorizontal } from "lucide-react";
import { TicketMaintenanceDialog } from "@/components/reception/TicketMaintenanceDialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExportCsvButton } from "@/components/common/ExportCsvButton";
import { formatDuration, formatKg, formatKgInt, formatTonnesInt, formatHm, kgToTonnes, isOverdue } from "@/lib/reception";
import { TicketDetailDialog } from "./TicketDetailDialog";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { FilterSheet } from "@/components/responsive/FilterSheet";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { CsvImportDialog } from "@/components/reception/CsvImportDialog";
import { ImportedTicketsPurgeDialog } from "@/components/reception/ImportedTicketsPurgeDialog";
import type { ImportReport } from "@/lib/receptionImport";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";



type ColKey = "created_by" | "cloture_by" | "cloture_at" | "photos" | "code_saisi";
type SortKey =
  | "numero" | "date_ticket" | "fournisseur" | "produit" | "duree_minutes"
  | "taux_abattement" | "poids_brut_kg" | "poids_abattement_kg" | "poids_net_kg" | "etat_pesee";
const SORT_LABELS: Record<SortKey, string> = {
  numero: "N° ticket", date_ticket: "Date", fournisseur: "Fournisseur", produit: "Produit",
  duree_minutes: "Durée", taux_abattement: "Taux abattement", poids_brut_kg: "Poids brut",
  poids_abattement_kg: "Abattement kg", poids_net_kg: "Poids net", etat_pesee: "État",
};
const COL_LS_KEY = "reception-global-cols";
const VIEW_LS_KEY = "reception-global-view";
const DEFAULT_COLS: Record<ColKey, boolean> = {
  created_by: false, cloture_by: false, cloture_at: false, photos: true, code_saisi: false,
};

/** Datetime local "YYYY-MM-DDTHH:mm" d'un ticket (date + heure de début). */
const ticketDateTime = (r: any) =>
  `${r.date_ticket}T${String(r.heure_debut ?? "00:00").slice(0, 5)}`;

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalDT = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Journée de réception : 06:00 → 05:59 le lendemain. */
function receptionDayRange(base = new Date()) {
  const start = new Date(base);
  if (start.getHours() < 6) start.setDate(start.getDate() - 1);
  start.setHours(6, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(5, 59, 0, 0);
  return { from: toLocalDT(start), to: toLocalDT(end) };
}



export default function ReceptionGlobal() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { canEdit, canDelete } = usePermissions();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin");
  const canImport = canEdit("reception_global") || canDelete("reception_global");
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"ignore" | "replace">("ignore");
  const [importPoidsOpen, setImportPoidsOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [maintenance, setMaintenance] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [f, setF] = useState({
    from: "", to: "", fromDT: "", toDT: "", campaign: "__all__", supplier: "__all__", product: "__all__",
    etat: "__all__", conformite: "__all__", q: "",
  });


  const [cols, setCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const s = localStorage.getItem(COL_LS_KEY);
      if (s) return { ...DEFAULT_COLS, ...JSON.parse(s) };
    } catch { /* ignore */ }
    return DEFAULT_COLS;
  });
  const [view, setView] = useState<"cards" | "table">(() => {
    try { return (localStorage.getItem(VIEW_LS_KEY) as any) ?? "cards"; } catch { return "cards"; }
  });
  useEffect(() => {
    try { localStorage.setItem(COL_LS_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
  }, [cols]);
  useEffect(() => {
    try { localStorage.setItem(VIEW_LS_KEY, view); } catch { /* ignore */ }
  }, [view]);
  const [selected, setSelected] = useState<any | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "numero", dir: "desc" });
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "numero" || key === "date_ticket" ? "desc" : "asc" }));

  const fmtDT = (v?: string | null) =>
    v ? new Date(v).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) : "—";

  const { data: rows = [] } = useQuery({
    queryKey: ["v_reception_global"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_reception_global")
        .select("*").in("statut", ["cloture", "pese_importe"]).order("numero", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["v_reception_global"] });
  useShiftRealtime("reception-global-tickets", "reception_tickets", invalidate);
  useShiftRealtime("reception-global-weighings", "reception_weighings", invalidate);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      // 1) Récupère les photos avant suppression pour nettoyer le bucket.
      const { data: photos } = await supabase
        .from("reception_ticket_photos" as any)
        .select("storage_path")
        .eq("ticket_id", toDelete.id);
      const paths = ((photos ?? []) as any[]).map((p) => p.storage_path).filter(Boolean);

      // 2) Suppression logique + cascade DB via RPC admin.
      const { error } = await supabase.rpc("admin_delete_reception_ticket" as any, {
        p_ticket_id: toDelete.id,
        p_reason: deleteReason.trim() || null,
      });
      if (error) throw error;

      // 3) Nettoyage bucket reception-photos (best-effort).
      if (paths.length > 0) {
        const { error: rmErr } = await supabase.storage.from("reception-photos").remove(paths);
        if (rmErr) console.warn("Nettoyage bucket partiel:", rmErr.message);
      }

      toast({ title: "Ticket supprimé", description: `N° ${toDelete.numero} — ${paths.length} photo(s) nettoyée(s)` });
      setToDelete(null);
      setDeleteReason("");
      invalidate();
    } catch (e: any) {
      toast({ title: "Suppression impossible", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };


  const { data: campaigns = [] } = useQuery({
    queryKey: ["reception_campaigns", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("reception_campaigns" as any).select("id, libelle, objectif_kg");
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (f.from && r.date_ticket < f.from) return false;
      if (f.to && r.date_ticket > f.to) return false;
      if (f.fromDT || f.toDT) {
        const dt = ticketDateTime(r);
        if (f.fromDT && dt < f.fromDT) return false;
        if (f.toDT && dt > f.toDT) return false;
      }

      if (f.campaign !== "__all__" && r.campaign_id !== f.campaign) return false;
      if (f.supplier !== "__all__" && r.supplier_id !== f.supplier) return false;
      if (f.product !== "__all__" && r.product_id !== f.product) return false;
      if (f.etat !== "__all__" && r.etat_pesee !== f.etat) return false;
      if (f.conformite === "conforme" && isOverdue(r.duree_minutes)) return false;
      if (f.conformite === "hors_delai" && !isOverdue(r.duree_minutes)) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        if (![r.numero, r.fournisseur, r.produit, r.wilaya, r.region].some((v) => (v ?? "").toString().toLowerCase().includes(q))) return false;
      }
      return true;
    });
    // Tri : par défaut N° ticket du plus grand au plus petit, sinon colonne choisie.
    const dir = sort.dir === "asc" ? 1 : -1;
    const numKeys: SortKey[] = ["numero", "duree_minutes", "taux_abattement", "poids_brut_kg", "poids_abattement_kg", "poids_net_kg"];
    return list.sort((a, b) => {
      if (sort.key === "numero") {
        const na = Number(String(a.numero ?? "").replace(/\D/g, "")) || 0;
        const nb = Number(String(b.numero ?? "").replace(/\D/g, "")) || 0;
        if (na !== nb) return (na - nb) * dir;
        return String(a.numero ?? "").localeCompare(String(b.numero ?? "")) * dir;
      }
      if (numKeys.includes(sort.key)) {
        const na = a[sort.key] == null ? -Infinity : Number(a[sort.key]);
        const nb = b[sort.key] == null ? -Infinity : Number(b[sort.key]);
        return (na - nb) * dir;
      }
      return String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "fr") * dir;
    });
  }, [rows, f, sort]);

  // Indicateurs calculés côté base sur l'INTÉGRALITÉ des tickets correspondant aux filtres
  // (et non seulement sur les 1000 lignes affichées).
  const statsArgs = {
    p_from: f.from || null,
    p_to: f.to || null,
    p_from_ts: f.fromDT ? `${f.fromDT}:00` : null,
    p_to_ts: f.toDT ? `${f.toDT}:59` : null,

    p_campaign: f.campaign !== "__all__" ? f.campaign : null,
    p_supplier: f.supplier !== "__all__" ? f.supplier : null,
    p_product: f.product !== "__all__" ? f.product : null,
    p_etat: f.etat !== "__all__" ? f.etat : null,
    p_conformite: f.conformite !== "__all__" ? f.conformite : null,
    p_q: f.q.trim() || null,
  };

  const { data: stats } = useQuery({
    queryKey: ["v_reception_global_stats", statsArgs],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_reception_kpis" as any, {
        p_date_from: statsArgs.p_from,
        p_date_to: statsArgs.p_to,
        p_dt_from: statsArgs.p_from_ts,
        p_dt_to: statsArgs.p_to_ts,
        p_campaign_id: statsArgs.p_campaign,
        p_supplier_id: statsArgs.p_supplier,
        p_product_id: statsArgs.p_product,
        p_etat: statsArgs.p_etat,
        p_conformite: statsArgs.p_conformite,
        p_search: statsArgs.p_q
      });
      if (error) throw error;
      return (data ?? {}) as any;
    },
    placeholderData: (prev) => prev,
  });

  const kpis = useMemo(() => ({
    total: Number(stats?.total ?? 0),
    pese: Number(stats?.pese ?? 0),
    aPeser: Number(stats?.aPeser ?? 0),
    hd: Number(stats?.hd ?? 0),
    brut: Number(stats?.brut ?? 0),
    net: Number(stats?.net ?? 0),
    abat: Number(stats?.abat ?? 0),
    moyDuree: stats?.moy_duree != null ? Number(stats.moy_duree) : null,
    nbDuree: Number(stats?.nb_duree ?? 0),
    tauxAbatMoyen: stats?.net && (Number(stats.net) + Number(stats.abat)) > 0 
      ? (Number(stats.abat) / (Number(stats.net) + Number(stats.abat))) * 100 
      : 0,
    jours: Number(stats?.jours ?? 0),
    moyNetJour: stats?.jours && Number(stats.jours) > 0 ? Number(stats.net) / Number(stats.jours) : 0,
  }), [stats]);

  const activeCampaign = campaigns.find((c) => c.id === f.campaign);
  const progression = activeCampaign?.objectif_kg
    ? Math.min(100, (kpis.net / Number(activeCampaign.objectif_kg)) * 100)
    : null;


  const distinct = (idKey: "campaign_id" | "supplier_id" | "product_id", labelKey: "campagne" | "fournisseur" | "produit") =>
    Array.from(new Map(rows.map((r: any) => [r[idKey], { id: r[idKey], label: r[labelKey] ?? r[idKey] }])).values())
      .filter((x) => x.id);

  const resetFilters = () =>
    setF({ from: "", to: "", fromDT: "", toDT: "", campaign: "__all__", supplier: "__all__", product: "__all__", etat: "__all__", conformite: "__all__", q: "" });


  const activeFilterCount =
    (f.from ? 1 : 0) + (f.to ? 1 : 0) + (f.fromDT ? 1 : 0) + (f.toDT ? 1 : 0) +

    (f.campaign !== "__all__" ? 1 : 0) + (f.supplier !== "__all__" ? 1 : 0) +
    (f.product !== "__all__" ? 1 : 0) + (f.etat !== "__all__" ? 1 : 0) +
    (f.conformite !== "__all__" ? 1 : 0) + (f.q ? 1 : 0);

  const applyToday = () => {
    const r = receptionDayRange();
    setF((p) => ({ ...p, from: "", to: "", fromDT: r.from, toDT: r.to }));
  };
  const isTodayActive = (() => {
    const r = receptionDayRange();
    return f.fromDT === r.from && f.toDT === r.to;
  })();

  const filtersForm = (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
      <div className="sm:col-span-2 md:col-span-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={isTodayActive ? "secondary" : "outline"}
          className="h-9"
          onClick={() => (isTodayActive ? setF({ ...f, fromDT: "", toDT: "" }) : applyToday())}
        >
          Aujourd'hui (6h → 6h)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => {
            const r = receptionDayRange(new Date(Date.now() - 24 * 3600 * 1000));
            setF({ ...f, from: "", to: "", fromDT: r.from, toDT: r.to });
          }}
        >
          Hier (6h → 6h)
        </Button>
        {(f.fromDT || f.toDT) && (
          <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setF({ ...f, fromDT: "", toDT: "" })}>
            Effacer date+heure
          </Button>
        )}
      </div>
      <div><Label>Du (date)</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
      <div><Label>Au (date)</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      <div>
        <Label>Début (date + heure)</Label>
        <Input
          type="datetime-local"
          value={f.fromDT}
          onChange={(e) => {
            const v = e.target.value;
            setF({ ...f, from: "", to: "", fromDT: v ? (v.endsWith("T00:00") ? v.replace("T00:00", "T06:00") : v) : "" });
          }}
        />
      </div>
      <div>
        <Label>Fin (date + heure)</Label>
        <Input
          type="datetime-local"
          value={f.toDT}
          onChange={(e) => {
            const v = e.target.value;
            setF({ ...f, from: "", to: "", toDT: v ? (v.endsWith("T00:00") ? v.replace("T00:00", "T05:59") : v) : "" });
          }}
        />
      </div>

      <div><Label>Campagne</Label>
        <Select value={f.campaign} onValueChange={(v) => setF({ ...f, campaign: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes</SelectItem>
            {distinct("campaign_id", "campagne").map((x: any) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Fournisseur</Label>
        <Select value={f.supplier} onValueChange={(v) => setF({ ...f, supplier: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous</SelectItem>
            {distinct("supplier_id", "fournisseur").map((x: any) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Produit</Label>
        <Select value={f.product} onValueChange={(v) => setF({ ...f, product: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous</SelectItem>
            {distinct("product_id", "produit").map((x: any) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>État</Label>
        <Select value={f.etat} onValueChange={(v) => setF({ ...f, etat: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous</SelectItem>
            <SelectItem value="pese">Pesé</SelectItem>
            <SelectItem value="a_peser">À peser (sans poids brut)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Conformité durée</Label>
        <Select value={f.conformite} onValueChange={(v) => setF({ ...f, conformite: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes</SelectItem>
            <SelectItem value="conforme">Conforme (≤ 20 min)</SelectItem>
            <SelectItem value="hors_delai">Hors délai (&gt; 20 min)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Recherche</Label><Input placeholder="N°, fournisseur, wilaya…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
      <div><Label>Trier par</Label>
        <Select value={sort.key} onValueChange={(v) => setSort((s) => ({ ...s, key: v as SortKey }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Ordre</Label>
        <Select value={sort.dir} onValueChange={(v) => setSort((s) => ({ ...s, dir: v as "asc" | "desc" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Décroissant (plus grand → plus petit)</SelectItem>
            <SelectItem value="asc">Croissant</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <span className="text-[10px] text-muted-foreground">{sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-1.5 md:gap-3">
        <Kpi label="Tickets" value={kpis.total} icon={TicketIcon} tone="primary" />
        <Kpi label="Pesés" value={kpis.pese} icon={CheckCircle2} tone="success" />
        <Kpi label="À peser" value={kpis.aPeser} icon={Hourglass} tone={kpis.aPeser > 0 ? "warning" : "default"} />
        <Kpi label="Hors délai" value={kpis.hd} icon={AlertTriangle} tone={kpis.hd > 0 ? "destructive" : "default"} />
        <Kpi label="Poids brut" value={formatTonnesInt(kpis.brut)} icon={Package} />
        <Kpi label="Poids net" value={formatTonnesInt(kpis.net)} icon={Scale} tone="primary" />
        <Kpi label="Abattement" value={formatTonnesInt(kpis.abat)} icon={TrendingDown} />
        <Kpi
          label="Moy. abattement"
          icon={Percent}
          value={kpis.tauxAbatMoyen != null ? `${kpis.tauxAbatMoyen.toFixed(2)} %` : "—"}
        />
        <Kpi
          label="Moy. net / jour"
          icon={CalendarDays}
          hint={kpis.jours ? `${kpis.jours} j` : undefined}
          value={kpis.moyNetJour != null ? formatTonnesInt(kpis.moyNetJour) : "—"}
        />
        <Kpi
          label="Durée moyenne"
          icon={Timer}
          hint={kpis.nbDuree ? `${kpis.nbDuree} ticket(s)` : undefined}
          value={formatDuration(kpis.moyDuree != null ? Math.round(kpis.moyDuree) : null)}
        />
      </div>



      {progression != null && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression campagne — {activeCampaign?.libelle}</span>
              <span className="font-medium">{kgToTonnes(kpis.net)} t / {kgToTonnes(activeCampaign.objectif_kg)} t</span>
            </div>
            <Progress value={progression} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base md:text-lg">Consultation globale</CardTitle>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="md:hidden">
                <FilterSheet
                  activeCount={activeFilterCount}
                  onReset={resetFilters}
                >
                  {filtersForm}
                </FilterSheet>
              </div>
              <div className="hidden md:flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  size="sm"
                  variant={view === "cards" ? "secondary" : "ghost"}
                  className="h-8 px-2"
                  onClick={() => setView("cards")}
                  title="Vue cartes"
                ><LayoutGrid className="h-4 w-4" /></Button>
                <Button
                  size="sm"
                  variant={view === "table" ? "secondary" : "ghost"}
                  className="h-8 px-2"
                  onClick={() => setView("table")}
                  title="Vue tableau"
                ><TableIcon className="h-4 w-4" /></Button>
              </div>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={resetFilters}><RotateCcw className="h-4 w-4 mr-1" />Réinit.</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><Columns3 className="h-4 w-4 mr-1" />Colonnes</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Colonnes optionnelles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={cols.photos} onCheckedChange={(v) => setCols({ ...cols, photos: !!v })}>Photos</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={cols.code_saisi} onCheckedChange={(v) => setCols({ ...cols, code_saisi: !!v })}>N° système</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={cols.created_by} onCheckedChange={(v) => setCols({ ...cols, created_by: !!v })}>Créé par</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={cols.cloture_by} onCheckedChange={(v) => setCols({ ...cols, cloture_by: !!v })}>Clôturé par</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={cols.cloture_at} onCheckedChange={(v) => setCols({ ...cols, cloture_at: !!v })}>Clôturé le</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canImport && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" />Importer
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setImportPoidsOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" />Importer poids bruts
                  </Button>
                </>
              )}
              {canDelete("reception_global") && (
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setPurgeOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />Supprimer les tickets importés
                </Button>
              )}
              <ExportCsvButton
                filename="reception-global"
                data={filtered.map((r) => ({
                  ...r,
                  duree: formatDuration(r.duree_minutes),
                  cloture_at_fmt: fmtDT(r.cloture_at),
                }))}
                columns={[
                  { key: "numero", label: "N° ticket" },
                  { key: "code_saisi", label: "N° système" },
                  { key: "date_ticket", label: "Date" },
                  { key: "campagne", label: "Campagne" },
                  { key: "produit", label: "Produit" },
                  { key: "fournisseur", label: "Fournisseur" },
                  { key: "wilaya", label: "Wilaya" },
                  { key: "heure_debut", label: "Début" },
                  { key: "heure_fin", label: "Fin" },
                  { key: "duree", label: "Durée" },
                  { key: "taux_abattement", label: "Abat. %" },
                  { key: "poids_brut_kg", label: "Brut (kg)" },
                  { key: "poids_abattement_kg", label: "Abat. (kg)" },
                  { key: "poids_net_kg", label: "Net (kg)" },
                  { key: "etat_pesee", label: "État pesée" },
                  { key: "created_by_name", label: "Créé par" },
                  { key: "cloture_by_name", label: "Clôturé par" },
                  { key: "cloture_at_fmt", label: "Clôturé le" },
                  { key: "nb_photos", label: "Photos" },
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:block rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount} actif(s)</Badge>
              )}
            </div>
            {filtersForm}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <Button
              size="sm"
              variant={isTodayActive ? "default" : "outline"}
              className="h-7 rounded-full px-3"
              onClick={() => (isTodayActive ? setF({ ...f, fromDT: "", toDT: "" }) : applyToday())}
            >
              Aujourd'hui (6h → 6h)
            </Button>

            <Button
              size="sm"
              variant={f.etat === "a_peser" ? "default" : "outline"}
              className="h-7 rounded-full px-3"
              onClick={() => setF({ ...f, etat: f.etat === "a_peser" ? "__all__" : "a_peser" })}
            >
              Non pesés uniquement
            </Button>
            <span className="ml-auto tabular-nums">
              <span className="font-medium text-foreground">{filtered.length}</span> ligne(s) affichée(s) sur{" "}
              <span className="font-medium text-foreground">{kpis.total}</span> ticket(s)
            </span>
          </div>




          {(isMobile || view === "cards") ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filtered.map((r: any) => {
                const overdue = isOverdue(r.duree_minutes);
                const pese = r.etat_pesee === "pese";
                const borderColor = overdue
                  ? "border-l-destructive"
                  : pese
                  ? "border-l-success"
                  : "border-l-warning";
                return (
                  <div
                    key={r.id}
                    className={`relative rounded-xl border border-l-[4px] ${borderColor} bg-card shadow-sm hover:shadow-md hover:bg-accent/30 transition-all`}
                  >
                    {isAdmin && (
                      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
                        <button
                          type="button"
                          title="Maintenance ticket"
                          onClick={(e) => { e.stopPropagation(); setMaintenance(r); }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Supprimer (admin)"
                          onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="text-left w-full p-3 space-y-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] text-muted-foreground">
                            #{r.numero}
                            {r.code_saisi && <span className="ml-1.5 text-foreground/70">· sys {r.code_saisi}</span>}
                          </div>
                          <div className="font-semibold truncate">{r.produit ?? "—"}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.fournisseur ?? "—"}</div>
                        </div>
                        <div className={`flex flex-col items-end gap-1 shrink-0 ${isAdmin ? "mr-7" : ""}`}>
                          {pese
                            ? <Badge variant="secondary">Pesé</Badge>
                            : <Badge>En attente</Badge>}
                          {r.statut === "pese_importe" && <Badge variant="outline" className="text-[10px]">Importé</Badge>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="tabular-nums">{r.date_ticket}</span>
                        <span>·</span>
                        <span className="tabular-nums">{formatHm(r.heure_debut)} → {formatHm(r.heure_fin)}</span>
                        <span>·</span>
                        <span className="tabular-nums">{formatDuration(r.duree_minutes)}</span>
                        {overdue && (
                          <Badge variant="destructive" className="h-5"><AlertTriangle className="h-3 w-3 mr-1" />Hors délai</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-2 border-t">
                        <WeightCell label="Brut" kg={r.poids_brut_kg} />
                        <WeightCell label="Abat." kg={r.poids_abattement_kg} />
                        <WeightCell label="Net" kg={r.poids_net_kg} emphasize />
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{Number(r.nb_photos ?? 0)}/3 photos</span>
                      </div>
                    </button>
                  </div>
                );

              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8">Aucun ticket</div>
              )}
            </div>
          ) : (
            <ScrollTable className="rounded-xl border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur [&_th]:h-9 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide">
                  <TableRow className="hover:bg-transparent">
                  <Th k="numero" label="N°" /><Th k="date_ticket" label="Date" /><Th k="fournisseur" label="Fournisseur" />
                  <Th k="produit" label="Produit" /><TableHead>Début/Fin</TableHead><Th k="duree_minutes" label="Durée" />
                  <Th k="taux_abattement" label="Abat." /><Th k="poids_brut_kg" label="Brut" className="text-right" />
                  <Th k="poids_abattement_kg" label="Abat. kg" className="text-right" /><Th k="poids_net_kg" label="Net" className="text-right" />
                  <Th k="etat_pesee" label="État" />
                  {cols.photos && <TableHead>Photos</TableHead>}
                  {cols.code_saisi && <TableHead>N° système</TableHead>}
                  {cols.created_by && <TableHead>Créé par</TableHead>}
                  {cols.cloture_by && <TableHead>Clôturé par</TableHead>}
                  {cols.cloture_at && <TableHead>Clôturé le</TableHead>}
                  {isAdmin && <TableHead className="w-[96px]"></TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer even:bg-muted/20 hover:bg-accent/50 transition-colors ${isOverdue(r.duree_minutes) ? "bg-destructive/10 hover:bg-destructive/15" : ""}`}
                      onClick={() => setSelected(r)}
                    >

                      <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                      <TableCell>{r.date_ticket}</TableCell>
                      <TableCell>{r.fournisseur}</TableCell>
                      <TableCell>{r.produit}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatHm(r.heure_debut)} / {formatHm(r.heure_fin)}</TableCell>
                      <TableCell>
                        {formatDuration(r.duree_minutes)}
                        {isOverdue(r.duree_minutes) && (
                          <Badge variant="destructive" className="ml-1"><AlertTriangle className="h-3 w-3 mr-1" />Hors délai</Badge>
                        )}
                      </TableCell>
                      <TableCell>{Number(r.taux_abattement).toFixed(2)} %</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKgInt(r.poids_brut_kg)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKgInt(r.poids_abattement_kg)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatKgInt(r.poids_net_kg)}</TableCell>
                      <TableCell>
                        {r.etat_pesee === "pese"
                          ? <Badge variant="secondary">Pesé</Badge>
                          : <Badge>En attente</Badge>}
                      </TableCell>
                      {cols.photos && (
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <ImageIcon className="h-3.5 w-3.5" />
                            {Number(r.nb_photos ?? 0)}/3
                          </span>
                        </TableCell>
                      )}
                      {cols.code_saisi && <TableCell className="font-mono text-xs">{r.code_saisi ?? "—"}</TableCell>}
                      {cols.created_by && <TableCell className="text-xs">{r.created_by_name ?? "—"}</TableCell>}
                      {cols.cloture_by && <TableCell className="text-xs">{r.cloture_by_name ?? "—"}</TableCell>}
                      {cols.cloture_at && <TableCell className="text-xs">{fmtDT(r.cloture_at)}</TableCell>}
                      {isAdmin && (
                        <TableCell className="p-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            title="Maintenance ticket"
                            onClick={(e) => { e.stopPropagation(); setMaintenance(r); }}
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Supprimer (admin)"
                            onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={11 + Object.values(cols).filter(Boolean).length + (isAdmin ? 1 : 0)} className="text-center text-muted-foreground py-8">Aucun ticket</TableCell></TableRow>}

                </TableBody>
              </Table>
            </ScrollTable>
          )}
        </CardContent>
      </Card>

      <TicketDetailDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        row={selected}
        canWeigh={canImport}
        onWeighed={() => { setSelected(null); invalidate(); qc.invalidateQueries({ queryKey: ["v_reception_global_stats"] }); }}
      />

      <TicketMaintenanceDialog
        open={!!maintenance}
        onOpenChange={(o) => { if (!o) setMaintenance(null); }}
        ticket={maintenance}
        allowTransfer={isAdmin}
        allowForce={isAdmin}
        onDone={() => {
          setMaintenance(null);
          invalidate();
          qc.invalidateQueries({ queryKey: ["v_reception_global_stats"] });
        }}
      />



      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des tickets de pesée"
        description="Statut appliqué : pesé importé. Ces tickets ne pourront pas être modifiés via le formulaire qualitatif."
        fields={[
          { key: "numero", label: "N° ticket", required: true, aliases: ["n", "num", "n_tick", "n_ticket", "num_ticket", "numero_ticket"] },
          { key: "date", label: "Date", required: true, aliases: ["date_ticket", "date_pesee", "date_pesée", "date_pesee_1", "date_pesée_1", "date_pesee_2"] },
          { key: "fournisseur", label: "Fournisseur", required: true, aliases: ["supplier", "code_fournisseur", "raison_cli", "raison_sociale", "client"] },
          { key: "produit", label: "Produit", required: true, aliases: ["product", "code_produit", "designation_produit"] },
          { key: "taux_abattement", label: "Abattement %", required: true, aliases: ["abat", "abattement", "taux", "%abat"] },
          { key: "poids_brut", label: "Poids brut (kg)", aliases: ["brut", "poids_brut_kg", "pesee_2", "pesée_2", "pesee2"] },
          { key: "poids_net", label: "Poids net (kg) — alt.", aliases: ["net", "pesée_net", "pesee_net"] },
          { key: "heure_debut", label: "Heure début", aliases: ["debut", "hdebut", "heure_pesee_1", "heure_pesée_1"] },
          { key: "heure_fin", label: "Heure fin", aliases: ["fin", "hfin", "heure_pesee_2", "heure_pesée_2"] },
          { key: "commentaire", label: "Commentaire", aliases: ["notes", "remarque", "raison_collecteur"] },
          { key: "numero_systeme", label: "Numéro système", aliases: ["n_systeme", "num_systeme", "code_systeme", "code_saisi", "code_pesee", "ref_systeme", "reference_systeme"] },
        ]}
        options={
          <div className="space-y-1">
            <div className="text-xs font-medium">Gestion des doublons (même N°)</div>
            <RadioGroup value={importMode} onValueChange={(v: any) => setImportMode(v)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem id="im-ignore" value="ignore" /><label htmlFor="im-ignore" className="text-xs">Ignorer</label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="im-replace" value="replace" /><label htmlFor="im-replace" className="text-xs">Remplacer</label></div>
            </RadioGroup>
          </div>
        }
        onImport={async (rows): Promise<ImportReport> => {
          const { data, error } = await supabase.rpc("import_reception_tickets" as any, { rows: rows as any, on_conflict: importMode });
          if (error) throw error;
          const r = (data ?? {}) as any;
          return { total: r.total ?? rows.length, success: r.success ?? 0, failed: r.failed ?? 0, extra: { créés: r.created ?? 0, remplacés: r.replaced ?? 0, ignorés: r.skipped ?? 0 }, errors: r.errors ?? [] };
        }}
        onSuccess={invalidate}
      />

      <CsvImportDialog
        open={importPoidsOpen}
        onOpenChange={setImportPoidsOpen}
        title="Importer les poids bruts"
        description="Met à jour uniquement le poids brut des tickets existants. Le poids net et l'abattement en tonnes sont recalculés automatiquement à partir du taux d'abattement déjà enregistré. Aucun autre champ n'est modifié. Les tickets introuvables sont ignorés."
        fields={[
          { key: "numero", label: "N° ticket", required: true, aliases: ["n", "num", "n_tick", "n_ticket", "num_ticket", "numero_ticket"] },
          { key: "poids_brut", label: "Poids brut (kg)", required: true, aliases: ["brut", "poids_brut_kg", "poids", "pesee_2", "pesée_2", "pesee2"] },
        ]}
        onImport={async (rows): Promise<ImportReport> => {
          const { data, error } = await supabase.rpc("import_reception_poids_bruts" as any, { rows: rows as any });
          if (error) throw error;
          const r = (data ?? {}) as any;
          return {
            total: r.total ?? rows.length,
            success: r.success ?? 0,
            failed: r.failed ?? 0,
            extra: { "mis à jour": r.updated ?? 0, "ignorés (introuvables)": r.skipped ?? 0 },
            errors: r.errors ?? [],
          };
        }}
        onSuccess={invalidate}
      />

      <ImportedTicketsPurgeDialog open={purgeOpen} onOpenChange={setPurgeOpen} onDeleted={invalidate} />




      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) { setToDelete(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le ticket ?</AlertDialogTitle>
            <AlertDialogDescription>
              Action irréversible. Le ticket <span className="font-mono font-semibold">#{toDelete?.numero}</span>
              {toDelete?.fournisseur ? <> — {toDelete.fournisseur}</> : null}, sa pesée, ses photos et ses orientations seront supprimés.
              L'opération est tracée dans le journal d'audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Motif (recommandé)</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value.slice(0, 500))}
              placeholder="Ex. doublon, saisie erronée, camion refusé…"
              className="min-h-[70px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function WeightCell({ label, kg, emphasize }: { label: string; kg?: number | null; emphasize?: boolean }) {
  return (
    <div className={`text-center rounded-md py-1 ${emphasize ? "bg-primary/5" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${emphasize ? "text-primary" : ""}`}>{formatTonnesInt(kg)}</div>
    </div>
  );
}

type KpiTone = "default" | "primary" | "success" | "warning" | "destructive";

const KPI_TONE: Record<KpiTone, { ring: string; icon: string; value: string }> = {
  default: { ring: "border-border", icon: "text-muted-foreground bg-muted", value: "text-foreground" },
  primary: { ring: "border-primary/30", icon: "text-primary bg-primary/10", value: "text-primary" },
  success: { ring: "border-success/30", icon: "text-success bg-success/10", value: "text-success" },
  warning: { ring: "border-warning/30", icon: "text-warning bg-warning/10", value: "text-warning" },
  destructive: { ring: "border-destructive/40", icon: "text-destructive bg-destructive/10", value: "text-destructive" },
};

function Kpi({
  label,
  value,
  tone = "default",
  icon: Icon,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: KpiTone;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  className?: string;
}) {
  const t = KPI_TONE[tone];
  return (
    <Card className={`min-w-0 overflow-hidden ${t.ring} shadow-sm transition-shadow hover:shadow-md ${className ?? ""}`}>
      <CardContent className="p-2.5 md:p-3 min-w-0 flex items-center gap-2.5">
        {Icon && (
          <span className={`hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[10px] leading-tight md:text-xs text-muted-foreground truncate" title={label}>{label}</div>
          <div className={`text-base md:text-xl font-semibold tabular-nums truncate ${t.value}`}>{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}



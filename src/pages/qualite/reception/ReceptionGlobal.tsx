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
import { AlertTriangle, RotateCcw, Columns3, Image as ImageIcon, LayoutGrid, TableIcon, Upload, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExportCsvButton } from "@/components/common/ExportCsvButton";
import { formatDuration, formatKg, formatKgInt, formatTonnesInt, formatHm, kgToTonnes, isOverdue } from "@/lib/reception";
import { TicketDetailDialog } from "./TicketDetailDialog";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { FilterSheet } from "@/components/responsive/FilterSheet";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { CsvImportDialog } from "@/components/reception/CsvImportDialog";
import type { ImportReport } from "@/lib/receptionImport";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";



type ColKey = "created_by" | "cloture_by" | "cloture_at" | "photos" | "code_saisi";
const COL_LS_KEY = "reception-global-cols";
const VIEW_LS_KEY = "reception-global-view";
const DEFAULT_COLS: Record<ColKey, boolean> = {
  created_by: false, cloture_by: false, cloture_at: false, photos: true, code_saisi: false,
};

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
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [f, setF] = useState({
    from: "", to: "", campaign: "__all__", supplier: "__all__", product: "__all__",
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

  const fmtDT = (v?: string | null) =>
    v ? new Date(v).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) : "—";

  const { data: rows = [] } = useQuery({
    queryKey: ["v_reception_global"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_reception_global")
        .select("*").order("date_ticket", { ascending: false }).limit(1000);
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
    // Tri : date la plus récente d'abord, puis dernier ticket (created_at desc, N° desc)
    return list.sort((a, b) => {
      const d = String(b.date_ticket ?? "").localeCompare(String(a.date_ticket ?? ""));
      if (d !== 0) return d;
      const t = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      if (t !== 0) return t;
      const na = Number(String(a.numero ?? "").replace(/\D/g, "")) || 0;
      const nb = Number(String(b.numero ?? "").replace(/\D/g, "")) || 0;
      return nb - na;
    });
  }, [rows, f]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const brut = filtered.reduce((s, r) => s + Number(r.poids_brut_kg ?? 0), 0);
    const net = filtered.reduce((s, r) => s + Number(r.poids_net_kg ?? 0), 0);
    const abat = filtered.reduce((s, r) => s + Number(r.poids_abattement_kg ?? 0), 0);
    const durees = filtered.map((r) => r.duree_minutes).filter((v) => v != null);
    const moyDuree = durees.length ? durees.reduce((s, v) => s + v, 0) / durees.length : null;
    const hd = filtered.filter((r) => isOverdue(r.duree_minutes)).length;
    const pese = filtered.filter((r) => r.etat_pesee === "pese").length;
    return { total, brut, net, abat, moyDuree, hd, pese, aPeser: total - pese };
  }, [filtered]);

  const activeCampaign = campaigns.find((c) => c.id === f.campaign);
  const progression = activeCampaign?.objectif_kg
    ? Math.min(100, (kpis.net / Number(activeCampaign.objectif_kg)) * 100)
    : null;

  const distinct = (idKey: "campaign_id" | "supplier_id" | "product_id", labelKey: "campagne" | "fournisseur" | "produit") =>
    Array.from(new Map(rows.map((r: any) => [r[idKey], { id: r[idKey], label: r[labelKey] ?? r[idKey] }])).values())
      .filter((x) => x.id);

  const resetFilters = () =>
    setF({ from: "", to: "", campaign: "__all__", supplier: "__all__", product: "__all__", etat: "__all__", conformite: "__all__", q: "" });

  const activeFilterCount =
    (f.from ? 1 : 0) + (f.to ? 1 : 0) +
    (f.campaign !== "__all__" ? 1 : 0) + (f.supplier !== "__all__" ? 1 : 0) +
    (f.product !== "__all__" ? 1 : 0) + (f.etat !== "__all__" ? 1 : 0) +
    (f.conformite !== "__all__" ? 1 : 0) + (f.q ? 1 : 0);

  const filtersForm = (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
      <div><Label>Du</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
      <div><Label>Au</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
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
            <SelectItem value="a_peser">À peser</SelectItem>
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
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
        <Kpi label="Tickets" value={kpis.total} />
        <Kpi label="Pesés" value={kpis.pese} />
        <Kpi label="À peser" value={kpis.aPeser} />
        <Kpi label="Hors délai" value={kpis.hd} accent={kpis.hd > 0} />
        <Kpi label="Poids brut" value={formatTonnesInt(kpis.brut)} />
        <Kpi label="Poids net" value={formatTonnesInt(kpis.net)} />
        <Kpi label="Abattement" value={formatTonnesInt(kpis.abat)} className="hidden sm:block" />
        <Kpi label="Durée moyenne" value={formatDuration(kpis.moyDuree ? Math.round(kpis.moyDuree) : null)} className="hidden sm:block" />
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
          <div className="hidden md:block">{filtersForm}</div>

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
                    className={`relative rounded-lg border border-l-[3px] ${borderColor} bg-card hover:bg-accent/40 transition-colors`}
                  >
                    {isAdmin && (
                      <button
                        type="button"
                        title="Supprimer (admin)"
                        onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
                        className="absolute top-1.5 right-1.5 z-10 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
            <ScrollTable>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Fournisseur</TableHead>
                  <TableHead>Produit</TableHead><TableHead>Début/Fin</TableHead><TableHead>Durée</TableHead>
                  <TableHead>Abat.</TableHead><TableHead className="text-right">Brut</TableHead>
                  <TableHead className="text-right">Abat. kg</TableHead><TableHead className="text-right">Net</TableHead>
                  <TableHead>État</TableHead>
                  {cols.photos && <TableHead>Photos</TableHead>}
                  {cols.code_saisi && <TableHead>N° système</TableHead>}
                  {cols.created_by && <TableHead>Créé par</TableHead>}
                  {cols.cloture_by && <TableHead>Clôturé par</TableHead>}
                  {cols.cloture_at && <TableHead>Clôturé le</TableHead>}
                  {isAdmin && <TableHead className="w-[52px]"></TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${isOverdue(r.duree_minutes) ? "bg-destructive/10" : ""}`}
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
                        <TableCell className="p-1">
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
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${emphasize ? "text-primary" : ""}`}>{formatTonnesInt(kg)}</div>
    </div>
  );
}


function Kpi({ label, value, accent, className }: { label: string; value: React.ReactNode; accent?: boolean; className?: string }) {
  return (
    <Card className={`${accent ? "border-destructive/40" : ""} ${className ?? ""}`}>
      <CardContent className="p-2.5 md:p-3">
        <div className="text-[11px] md:text-xs text-muted-foreground">{label}</div>
        <div className={"text-base md:text-xl font-semibold " + (accent ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}

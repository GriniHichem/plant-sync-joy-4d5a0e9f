import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { useEffect } from "react";
import { FlaskConical, Plus, Search, Trash2, ChevronRight, Lock } from "lucide-react";
import {
  INVESTIGATION_STATUSES, statusLabel, type LotInvestigation,
  defaultLotReference,
} from "@/lib/lotInvestigation";
import {
  useLotInvestigations, useLotInvestigationPermissions, logInvestigation,
} from "@/hooks/useLotInvestigations";

const ALL = "__all__";
const NONE = "__none__";

interface ProductOption { id: string; code: string | null; designation: string }

export default function QualiteEnquetesLot() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManage, canDelete } = useLotInvestigationPermissions();
  const { rows, loading, reload } = useLotInvestigations();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [ncs, setNcs] = useState<{ id: string; nc_number: string | null; title: string }[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    production_date: new Date().toISOString().slice(0, 10),
    production_time: "08:00",
    window_hours: "2",
    lot_reference: "",
    product_id: NONE,
    anomaly_description: "",
  });

  useEffect(() => {
    (async () => {
      const [p, n] = await Promise.all([
        (supabase as any).from("products").select("id, code, designation").eq("is_active", true).order("designation"),
        (supabase as any).from("quality_non_conformities").select("id, nc_number, title").order("detected_at", { ascending: false }).limit(300),
      ]);
      setProducts((p.data ?? []) as ProductOption[]);
      setNcs((n.data ?? []) as typeof ncs);
    })();
  }, []);

  const productLabel = (id: string | null) => {
    if (!id) return "—";
    const p = products.find((x) => x.id === id);
    return p ? `${p.code ? p.code + " · " : ""}${p.designation}` : "—";
  };
  const ncLabel = (id: string | null) => {
    if (!id) return null;
    const n = ncs.find((x) => x.id === id);
    return n ? `${n.nc_number ?? "NC"} — ${n.title}` : "NC liée";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (!q) return true;
      return `${r.investigation_number ?? ""} ${r.lot_reference ?? ""} ${r.anomaly_description ?? ""} ${productLabel(r.product_id)}`
        .toLowerCase().includes(q);
    });
  }, [rows, search, status, products]);

  const submit = async () => {
    if (!form.production_date || !form.production_time) {
      toast({ title: "Date et heure de production obligatoires", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("quality_lot_investigations")
      .insert({
        production_date: form.production_date,
        production_time: form.production_time,
        window_hours: Number(String(form.window_hours).replace(",", ".")) || 2,
        lot_reference: form.lot_reference.trim() || defaultLotReference(form.production_date) || null,
        product_id: form.product_id === NONE ? null : form.product_id,
        anomaly_description: form.anomaly_description.trim() || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Création impossible", description: error.message, variant: "destructive" });
      return;
    }
    await logInvestigation(data.id, "Création de l'enquête", {
      production_date: form.production_date, production_time: form.production_time,
    });
    toast({ title: "Enquête créée", description: data.investigation_number });
    setOpen(false);
    await reload();
    navigate(`/qualite/enquetes-lot/${data.id}`);
  };

  const remove = async (r: LotInvestigation) => {
    if (!confirm(`Supprimer définitivement l'enquête ${r.investigation_number ?? ""} ?`)) return;
    const { error } = await (supabase as any).from("quality_lot_investigations").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Suppression impossible", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Enquête supprimée" });
    await reload();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Enquêtes de lot</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Investigation des anomalies : événements autour d'une heure de production et lien avec les non-conformités
            </p>
          </div>
        </div>
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle enquête
          </Button>
        ) : (
          <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Lecture seule</Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-3 md:p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher (n° enquête, lot, produit, anomalie)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {INVESTIGATION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enquête</TableHead>
                  <TableHead>Production</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>NC associée</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Chargement…</TableCell></TableRow>
                )}
                {!loading && !filtered.length && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Aucune enquête</TableCell></TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer even:bg-muted/30"
                    onClick={() => navigate(`/qualite/enquetes-lot/${r.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{r.investigation_number ?? "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(r.production_date).toLocaleDateString("fr-FR")} · {r.production_time.slice(0, 5)}
                    </TableCell>
                    <TableCell className="text-sm">{productLabel(r.product_id)}</TableCell>
                    <TableCell className="text-sm">{r.lot_reference ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "cloturee" ? "secondary" : "default"}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{ncLabel(r.nc_id) ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => remove(r)} aria-label="Supprimer">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/qualite/enquetes-lot/${r.id}`)} aria-label="Ouvrir">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Nouvelle enquête de lot"
        description="Saisissez la date et l'heure de production du lot à investiguer"
        className="max-w-lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de production *</Label>
              <Input type="date" value={form.production_date}
                onChange={(e) => setForm({ ...form, production_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Heure de production *</Label>
              <Input type="time" value={form.production_time}
                onChange={(e) => setForm({ ...form, production_time: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>N° de lot <span className="text-xs text-muted-foreground">(défaut : jour de l'année)</span></Label>
              <Input placeholder={`Auto : ${defaultLotReference(form.production_date) || "jour de l'année"}`} value={form.lot_reference}
                onChange={(e) => setForm({ ...form, lot_reference: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Périmètre (± heures)</Label>
              <Input inputMode="decimal" value={form.window_hours}
                onChange={(e) => setForm({ ...form, window_hours: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Produit concerné</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Non précisé</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.designation}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description de l'anomalie</Label>
            <Textarea rows={3} placeholder="Ex : texture granuleuse constatée sur le lot"
              value={form.anomaly_description}
              onChange={(e) => setForm({ ...form, anomaly_description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Création…" : "Créer l'enquête"}</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

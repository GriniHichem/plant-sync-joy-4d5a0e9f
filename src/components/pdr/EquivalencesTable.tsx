import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, Trash2, Plus } from "lucide-react";
import { usePdrEquivalences, type EquivalenceType, type ValidationStatus } from "@/hooks/usePdrEquivalences";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const TYPE_LABELS: Record<EquivalenceType, string> = {
  equivalent: "Équivalent",
  compatible: "Compatible",
  remplacement: "Remplacement",
  depannage: "Dépannage",
};

const STATUS_BADGE: Record<ValidationStatus, { label: string; cls: string; icon: any }> = {
  non_valide: { label: "En attente", cls: "bg-amber-100 text-amber-900 border-amber-300", icon: Clock },
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: CheckCircle2 },
  rejete: { label: "Rejeté", cls: "bg-rose-100 text-rose-900 border-rose-300", icon: XCircle },
};

interface Props {
  pdrId: string;
  canValidate: boolean;
}

export function EquivalencesTable({ pdrId, canValidate }: Props) {
  const { items, loading, add, validate, remove, reload } = usePdrEquivalences(pdrId);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allPdrs, setAllPdrs] = useState<{ id: string; reference: string; designation: string }[]>([]);
  const [form, setForm] = useState({
    mode: "internal" as "internal" | "external",
    equivalent_pdr_id: "",
    external_reference: "",
    manufacturer: "",
    brand: "",
    equivalence_type: "equivalent" as EquivalenceType,
    notes: "",
  });

  useEffect(() => {
    supabase.from("pdr").select("id, reference, designation").neq("id", pdrId).order("reference").then(({ data }) => {
      setAllPdrs((data as any) || []);
    });
  }, [pdrId]);

  const handleAdd = async () => {
    if (form.mode === "internal" && !form.equivalent_pdr_id) {
      toast({ title: "Sélectionnez une PDR équivalente", variant: "destructive" }); return;
    }
    if (form.mode === "external" && !form.external_reference.trim()) {
      toast({ title: "Référence externe requise", variant: "destructive" }); return;
    }
    const { error } = await add({
      equivalent_pdr_id: form.mode === "internal" ? form.equivalent_pdr_id : null,
      external_reference: form.mode === "external" ? form.external_reference.trim() : null,
      manufacturer: form.manufacturer.trim() || null,
      brand: form.brand.trim() || null,
      equivalence_type: form.equivalence_type,
      notes: form.notes.trim() || "",
    });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Équivalence ajoutée", description: canValidate ? "" : "En attente de validation" });
    setDialogOpen(false);
    setForm({ mode: "internal", equivalent_pdr_id: "", external_reference: "", manufacturer: "", brand: "", equivalence_type: "equivalent", notes: "" });
    reload();
  };

  const handleValidate = async (id: string, status: ValidationStatus) => {
    const { error } = await validate(id, status);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: status === "valide" ? "Équivalence validée" : status === "rejete" ? "Équivalence rejetée" : "Réinitialisée" });
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette équivalence ?")) return;
    const { error } = await remove(id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    reload();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Équivalences</CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune équivalence enregistrée.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Référence équivalente</TableHead>
                <TableHead>Fabricant / Marque</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const StatusIcon = STATUS_BADGE[it.validation_status].icon;
                return (
                  <TableRow key={it.id}>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[it.equivalence_type]}</Badge></TableCell>
                    <TableCell>
                      {it.equivalent_pdr ? (
                        <span className="font-mono text-sm">{it.equivalent_pdr.reference} <span className="text-muted-foreground">— {it.equivalent_pdr.designation}</span></span>
                      ) : (
                        <span className="font-mono text-sm">{it.external_reference}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {[it.manufacturer, it.brand].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[it.validation_status].cls}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {STATUS_BADGE[it.validation_status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{it.notes || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {canValidate && it.validation_status !== "valide" && (
                        <Button size="sm" variant="outline" onClick={() => handleValidate(it.id, "valide")}>Valider</Button>
                      )}
                      {canValidate && it.validation_status !== "rejete" && (
                        <Button size="sm" variant="ghost" onClick={() => handleValidate(it.id, "rejete")}>Rejeter</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(it.id)} aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle équivalence</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type d'équivalence</Label>
              <Select value={form.equivalence_type} onValueChange={(v) => setForm({ ...form, equivalence_type: v as EquivalenceType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as EquivalenceType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">PDR interne</SelectItem>
                  <SelectItem value="external">Référence externe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.mode === "internal" ? (
              <div>
                <Label>PDR équivalente *</Label>
                <Select value={form.equivalent_pdr_id || "__none__"} onValueChange={(v) => setForm({ ...form, equivalent_pdr_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {allPdrs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.reference} — {p.designation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Référence externe *</Label>
                <Input value={form.external_reference} onChange={(e) => setForm({ ...form, external_reference: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Fabricant</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div><Label>Marque</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleAdd}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

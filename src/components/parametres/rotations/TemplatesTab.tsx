import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { logAudit } from "@/lib/audit";

const NONE = "__none__";

interface ShiftSystem { id: string; code: string; label: string; }

interface ShiftTemplate {
  id: string;
  code: string;
  label: string;
  heure_debut: string;
  heure_fin: string;
  crosses_midnight: boolean;
  couleur: string | null;
  sort_order: number;
  is_active: boolean;
  shift_mode_id: string | null;
}

const BLANK = {
  id: "", code: "", label: "", heure_debut: "06:00", heure_fin: "14:00",
  crosses_midnight: false, couleur: "#3b82f6", sort_order: 0, is_active: true,
  shift_mode_id: "" as string,
};

const hhmm = (t: string) => (t ? t.slice(0, 5) : "");

export function TemplatesTab({ onChange }: { onChange?: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ShiftTemplate[]>([]);
  const [systems, setSystems] = useState<ShiftSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<typeof BLANK>(BLANK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      supabase.from("shift_templates").select("*").order("sort_order"),
      supabase.from("shift_modes").select("id, code, label").eq("is_active", true).order("code"),
    ]);
    setRows((tRes.data as ShiftTemplate[]) ?? []);
    setSystems((sRes.data as ShiftSystem[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sysLabel = (id: string | null) => systems.find((s) => s.id === id)?.label ?? "—";

  const openNew = () => { setDraft({ ...BLANK, sort_order: rows.length }); setOpen(true); };
  const openEdit = (t: ShiftTemplate) => {
    setDraft({ ...t, heure_debut: hhmm(t.heure_debut), heure_fin: hhmm(t.heure_fin), couleur: t.couleur ?? "#3b82f6", shift_mode_id: t.shift_mode_id ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.code.trim() || !draft.label.trim()) {
      toast({ title: "Code et libellé requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const crosses = draft.heure_fin <= draft.heure_debut;
      const payload = {
        code: draft.code.trim().toLowerCase(),
        label: draft.label.trim(),
        heure_debut: draft.heure_debut,
        heure_fin: draft.heure_fin,
        crosses_midnight: crosses,
        couleur: draft.couleur,
        sort_order: draft.sort_order,
        is_active: draft.is_active,
        shift_mode_id: draft.shift_mode_id || null,
      };
      if (draft.id) {
        const { error } = await supabase.from("shift_templates").update(payload as any).eq("id", draft.id);
        if (error) throw error;
        await logAudit({ action_type: "update", module: "parametres", action: "shift_template_update", entity_type: "shift_templates", entity_id: draft.id, description: `Modèle ${payload.code} modifié` });
      } else {
        const { error } = await supabase.from("shift_templates").insert(payload as any);
        if (error) throw error;
        await logAudit({ action_type: "create", module: "parametres", action: "shift_template_create", entity_type: "shift_templates", description: `Modèle ${payload.code} créé` });
      }
      toast({ title: "Modèle enregistré" });
      setOpen(false);
      await load();
      onChange?.();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: ShiftTemplate) => {
    if (!confirm(`Supprimer le modèle ${t.label} ?`)) return;
    const { error } = await supabase.from("shift_templates").delete().eq("id", t.id);
    if (error) { toast({ title: "Suppression impossible", description: error.message, variant: "destructive" }); return; }
    await logAudit({ action_type: "delete", module: "parametres", action: "shift_template_delete", entity_type: "shift_templates", entity_id: t.id, description: `Modèle ${t.code} supprimé` });
    toast({ title: "Modèle supprimé" });
    await load();
    onChange?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nouveau modèle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{draft.id ? "Modifier" : "Nouveau"} modèle de shift</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="matin" />
                </div>
                <div className="space-y-1.5">
                  <Label>Libellé</Label>
                  <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Matin" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Début</Label>
                  <Input type="time" value={draft.heure_debut} onChange={(e) => setDraft({ ...draft, heure_debut: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input type="time" value={draft.heure_fin} onChange={(e) => setDraft({ ...draft, heure_fin: e.target.value })} />
                </div>
              </div>
              {draft.heure_fin <= draft.heure_debut && (
                <p className="text-xs text-amber-600">Ce créneau franchit minuit (nuit).</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Couleur</Label>
                  <Input type="color" value={draft.couleur} onChange={(e) => setDraft({ ...draft, couleur: e.target.value })} className="h-10 p-1" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordre</Label>
                  <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Système de production</Label>
                <Select value={draft.shift_mode_id || NONE} onValueChange={(v) => setDraft({ ...draft, shift_mode_id: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucun (créneau libre)</SelectItem>
                    {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                <Label>Actif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Chargement…</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Système</TableHead>
              <TableHead>Horaire</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.couleur ?? "#888" }} />
                    {t.label}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.code}</TableCell>
                <TableCell className="text-xs">{t.shift_mode_id ? <Badge variant="outline">{sysLabel(t.shift_mode_id)}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="tabular-nums">
                  {hhmm(t.heure_debut)} → {hhmm(t.heure_fin)} {t.crosses_midnight && <Badge variant="outline" className="ml-1 text-[10px]">nuit</Badge>}
                </TableCell>
                <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Actif" : "Inactif"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun modèle.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

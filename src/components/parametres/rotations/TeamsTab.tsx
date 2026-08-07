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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { logAudit } from "@/lib/audit";

export interface ShiftTeam {
  id: string;
  code: string;
  name: string;
  color: string;
  is_active: boolean;
}

const BLANK = { id: "", code: "", name: "", color: "#3b82f6", is_active: true };

export function TeamsTab({ onChange }: { onChange?: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ShiftTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<typeof BLANK>(BLANK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("shift_teams").select("*").order("code");
    setRows((data as ShiftTeam[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setDraft(BLANK); setOpen(true); };
  const openEdit = (t: ShiftTeam) => { setDraft({ ...t }); setOpen(true); };

  const save = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast({ title: "Code et nom requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        color: draft.color,
        is_active: draft.is_active,
      };
      if (draft.id) {
        const { error } = await supabase.from("shift_teams").update(payload).eq("id", draft.id);
        if (error) throw error;
        await logAudit({ action_type: "update", module: "parametres", action: "shift_team_update", entity_type: "shift_teams", entity_id: draft.id, description: `Équipe ${payload.code} modifiée` });
      } else {
        const { error } = await supabase.from("shift_teams").insert(payload);
        if (error) throw error;
        await logAudit({ action_type: "create", module: "parametres", action: "shift_team_create", entity_type: "shift_teams", description: `Équipe ${payload.code} créée` });
      }
      toast({ title: "Équipe enregistrée" });
      setOpen(false);
      await load();
      onChange?.();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: ShiftTeam) => {
    if (!confirm(`Supprimer l'équipe ${t.code} ?`)) return;
    const { error } = await supabase.from("shift_teams").delete().eq("id", t.id);
    if (error) { toast({ title: "Suppression impossible", description: error.message, variant: "destructive" }); return; }
    await logAudit({ action_type: "delete", module: "parametres", action: "shift_team_delete", entity_type: "shift_teams", entity_id: t.id, description: `Équipe ${t.code} supprimée` });
    toast({ title: "Équipe supprimée" });
    await load();
    onChange?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nouvelle équipe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{draft.id ? "Modifier" : "Nouvelle"} équipe</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="A" />
                </div>
                <div className="space-y-1.5">
                  <Label>Couleur</Label>
                  <Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 p-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Équipe A" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                <Label>Active</Label>
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
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Couleur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold">{t.code}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded" style={{ backgroundColor: t.color }} />
                    {t.color}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune équipe.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

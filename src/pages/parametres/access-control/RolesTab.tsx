import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { ROLES } from "@/lib/ruleCatalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  responsable_si: "Responsable SI",
  resp_maintenance: "Responsable Maintenance",
  maintenancier: "Maintenancier",
  resp_production: "Responsable Production",
  chef_ligne: "Chef de Ligne",
  operateur: "Opérateur",
  gestionnaire_magasin: "Gestionnaire Magasin",
  responsable_magasin: "Responsable Magasin",
  bureau_methode: "Bureau Méthode",
  auditeur: "Auditeur",
  controleur_qualite: "Contrôleur Qualité",
  responsable_controle_qualite: "Responsable Contrôle Qualité",
  directeur_qualite: "Directeur Qualité",
  agreeur: "Agréeur",
  responsable_inventaire: "Responsable Inventaire",
  agent_inventaire: "Agent Inventaire",
  agent_pont_bascule: "Agent Pont Bascule",
};

export default function RolesTab() {
  const { roles: custom, loading, reload } = useCustomRoles();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", label: "", description: "", color: "#64748b", inherits_from: "__none__" });

  async function save() {
    if (!form.code || !form.label) { toast.error("Code et libellé requis"); return; }
    const payload = {
      code: form.code.toLowerCase().replace(/\s+/g, "_"),
      label: form.label,
      description: form.description || null,
      color: form.color,
      inherits_from: form.inherits_from === "__none__" ? null : form.inherits_from,
      is_active: true,
    };
    const { error } = await (supabase.from("custom_roles" as any) as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Rôle créé");
    setOpen(false);
    setForm({ code: "", label: "", description: "", color: "#64748b", inherits_from: "__none__" });
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce rôle personnalisé ?")) return;
    await supabase.from("custom_roles" as any).delete().eq("id", id);
    reload();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Rôles système ({ROLES.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Badge key={r} variant="secondary">{SYSTEM_ROLE_LABELS[r] ?? r}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rôles personnalisés ({custom.length})</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nouveau rôle</Button>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Chargement…</p> : custom.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun rôle personnalisé. Créez-en un pour adapter les permissions à votre organisation.</p>
          ) : (
            <div className="space-y-2">
              {custom.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                    <div>
                      <p className="font-medium">{r.label} <span className="text-xs text-muted-foreground">({r.code})</span></p>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                      {r.inherits_from && <p className="text-xs">Hérite de : <Badge variant="outline">{SYSTEM_ROLE_LABELS[r.inherits_from] ?? r.inherits_from}</Badge></p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau rôle personnalisé</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex: superviseur_nuit" /></div>
            <div><Label>Libellé</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Superviseur de nuit" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Couleur</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20" /></div>
            <div>
              <Label>Hérite des permissions de</Label>
              <Select value={form.inherits_from} onValueChange={(v) => setForm({ ...form, inherits_from: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun (vide)</SelectItem>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{SYSTEM_ROLE_LABELS[r] ?? r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

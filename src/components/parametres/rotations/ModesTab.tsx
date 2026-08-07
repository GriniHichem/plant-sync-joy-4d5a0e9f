import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Clock } from "lucide-react";
import { logAudit } from "@/lib/audit";

interface ShiftSystem {
  id: string;
  code: string;
  label: string;
  description: string | null;
  nb_shifts: number;
  is_default: boolean;
  is_active: boolean;
}

interface SystemSlot {
  id: string;
  shift_mode_id: string;
  label: string;
  heure_debut: string;
  heure_fin: string;
  sort_order: number;
}

const BLANK_SYSTEM = {
  id: "", code: "", label: "", description: "", nb_shifts: 3, is_default: false, is_active: true,
};
const BLANK_SLOT = { id: "", label: "", heure_debut: "06:00", heure_fin: "14:00", sort_order: 0 };

const hhmm = (t: string) => (t ? t.slice(0, 5) : "");

/**
 * Systèmes de production (3×8, 2×12, journée continue…).
 * shift_modes / shift_mode_slots — consommés par les OF du GPAO.
 * CRUD complet : créer/éditer/supprimer un système et ses créneaux horaires.
 */
export function ModesTab() {
  const { toast } = useToast();
  const [systems, setSystems] = useState<ShiftSystem[]>([]);
  const [slots, setSlots] = useState<SystemSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [sysOpen, setSysOpen] = useState(false);
  const [sysDraft, setSysDraft] = useState<typeof BLANK_SYSTEM>(BLANK_SYSTEM);
  const [savingSys, setSavingSys] = useState(false);

  const [slotOpen, setSlotOpen] = useState(false);
  const [slotDraft, setSlotDraft] = useState<typeof BLANK_SLOT>(BLANK_SLOT);
  const [slotSystemId, setSlotSystemId] = useState<string>("");
  const [savingSlot, setSavingSlot] = useState(false);

  async function load() {
    setLoading(true);
    const [modesRes, slotsRes] = await Promise.all([
      supabase.from("shift_modes").select("*").order("code"),
      supabase.from("shift_mode_slots").select("*").order("sort_order"),
    ]);
    setSystems((modesRes.data as ShiftSystem[]) ?? []);
    setSlots((slotsRes.data as SystemSlot[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  /* ---------- Systèmes ---------- */
  const openNewSystem = () => { setSysDraft(BLANK_SYSTEM); setSysOpen(true); };
  const openEditSystem = (s: ShiftSystem) => {
    setSysDraft({ ...s, description: s.description ?? "" });
    setSysOpen(true);
  };

  const saveSystem = async () => {
    if (!sysDraft.code.trim() || !sysDraft.label.trim()) {
      toast({ title: "Code et libellé requis", variant: "destructive" });
      return;
    }
    setSavingSys(true);
    try {
      const payload = {
        code: sysDraft.code.trim().toLowerCase(),
        label: sysDraft.label.trim(),
        description: sysDraft.description.trim() || null,
        nb_shifts: Number(sysDraft.nb_shifts) || 1,
        is_default: sysDraft.is_default,
        is_active: sysDraft.is_active,
      };
      // Un seul système par défaut.
      if (payload.is_default) {
        await supabase.from("shift_modes").update({ is_default: false } as any).neq("id", sysDraft.id || "00000000-0000-0000-0000-000000000000");
      }
      if (sysDraft.id) {
        const { error } = await supabase.from("shift_modes").update(payload as any).eq("id", sysDraft.id);
        if (error) throw error;
        await logAudit({ action_type: "update", module: "parametres", action: "shift_system_update", entity_type: "shift_modes", entity_id: sysDraft.id, description: `Système ${payload.code} modifié` });
      } else {
        const { error } = await supabase.from("shift_modes").insert(payload as any);
        if (error) throw error;
        await logAudit({ action_type: "create", module: "parametres", action: "shift_system_create", entity_type: "shift_modes", description: `Système ${payload.code} créé` });
      }
      toast({ title: "Système enregistré" });
      setSysOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSavingSys(false);
    }
  };

  const removeSystem = async (s: ShiftSystem) => {
    if (s.is_default) { toast({ title: "Système par défaut", description: "Définissez un autre système par défaut avant de le supprimer.", variant: "destructive" }); return; }
    if (!confirm(`Supprimer le système « ${s.label} » et ses créneaux ?`)) return;
    await supabase.from("shift_mode_slots").delete().eq("shift_mode_id", s.id);
    const { error } = await supabase.from("shift_modes").delete().eq("id", s.id);
    if (error) { toast({ title: "Suppression impossible", description: error.message, variant: "destructive" }); return; }
    await logAudit({ action_type: "delete", module: "parametres", action: "shift_system_delete", entity_type: "shift_modes", entity_id: s.id, description: `Système ${s.code} supprimé` });
    toast({ title: "Système supprimé" });
    await load();
  };

  const toggleActive = async (s: ShiftSystem) => {
    await supabase.from("shift_modes").update({ is_active: !s.is_active } as any).eq("id", s.id);
    await load();
  };

  /* ---------- Créneaux ---------- */
  const openNewSlot = (systemId: string, count: number) => {
    setSlotSystemId(systemId);
    setSlotDraft({ ...BLANK_SLOT, sort_order: count });
    setSlotOpen(true);
  };
  const openEditSlot = (slot: SystemSlot) => {
    setSlotSystemId(slot.shift_mode_id);
    setSlotDraft({ ...slot, heure_debut: hhmm(slot.heure_debut), heure_fin: hhmm(slot.heure_fin) });
    setSlotOpen(true);
  };

  const saveSlot = async () => {
    if (!slotDraft.label.trim()) { toast({ title: "Libellé du créneau requis", variant: "destructive" }); return; }
    setSavingSlot(true);
    try {
      const payload = {
        shift_mode_id: slotSystemId,
        label: slotDraft.label.trim(),
        heure_debut: slotDraft.heure_debut,
        heure_fin: slotDraft.heure_fin,
        sort_order: slotDraft.sort_order,
      };
      if (slotDraft.id) {
        const { error } = await supabase.from("shift_mode_slots").update(payload as any).eq("id", slotDraft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shift_mode_slots").insert(payload as any);
        if (error) throw error;
      }
      toast({ title: "Créneau enregistré" });
      setSlotOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSavingSlot(false);
    }
  };

  const removeSlot = async (slot: SystemSlot) => {
    if (!confirm(`Supprimer le créneau « ${slot.label} » ?`)) return;
    const { error } = await supabase.from("shift_mode_slots").delete().eq("id", slot.id);
    if (error) { toast({ title: "Suppression impossible", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Créneau supprimé" });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Définissez les systèmes de production (3×8, 2×12, journée continue…) et leurs créneaux horaires.
          Ces systèmes sont proposés lors de la création des ordres de fabrication.
        </p>
        <Dialog open={sysOpen} onOpenChange={setSysOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewSystem} className="shrink-0"><Plus className="h-4 w-4 mr-2" /> Nouveau système</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{sysDraft.id ? "Modifier" : "Nouveau"} système de production</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={sysDraft.code} onChange={(e) => setSysDraft({ ...sysDraft, code: e.target.value })} placeholder="3x8" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre de shifts</Label>
                  <Input type="number" min={1} value={sysDraft.nb_shifts} onChange={(e) => setSysDraft({ ...sysDraft, nb_shifts: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Libellé</Label>
                <Input value={sysDraft.label} onChange={(e) => setSysDraft({ ...sysDraft, label: e.target.value })} placeholder="3 Shifts (3×8)" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={sysDraft.description} onChange={(e) => setSysDraft({ ...sysDraft, description: e.target.value })} placeholder="Rotation matin / après-midi / nuit…" rows={2} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={sysDraft.is_active} onCheckedChange={(v) => setSysDraft({ ...sysDraft, is_active: v })} />
                  <Label>Actif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={sysDraft.is_default} onCheckedChange={(v) => setSysDraft({ ...sysDraft, is_default: v })} />
                  <Label>Par défaut</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSysOpen(false)}>Annuler</Button>
              <Button onClick={saveSystem} disabled={savingSys}>{savingSys && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Chargement…</div>
      ) : systems.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Aucun système de production. Cliquez sur « Nouveau système » pour en créer un.</CardContent></Card>
      ) : (
        systems.map((sys) => {
          const sysSlots = slots.filter((s) => s.shift_mode_id === sys.id);
          return (
            <Card key={sys.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {sys.label}
                      <Badge variant="outline" className="text-[10px] uppercase">{sys.code}</Badge>
                      {sys.is_default && <Badge variant="outline" className="text-[10px]">Par défaut</Badge>}
                    </CardTitle>
                    {sys.description && <p className="text-xs text-muted-foreground mt-1">{sys.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={sys.is_active ? "default" : "secondary"}>{sys.is_active ? "Actif" : "Inactif"}</Badge>
                    <Switch checked={sys.is_active} onCheckedChange={() => toggleActive(sys)} />
                    <Button variant="ghost" size="icon" onClick={() => openEditSystem(sys)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeSystem(sys)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Créneaux horaires ({sysSlots.length})
                  </p>
                  <Button variant="outline" size="sm" onClick={() => openNewSlot(sys.id, sysSlots.length)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Créneau
                  </Button>
                </div>
                {sysSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Aucun créneau. Ajoutez-en un.</p>
                ) : (
                  <div className="space-y-1">
                    {sysSlots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-3 text-sm border rounded-md px-3 py-1.5">
                        <span className="font-medium min-w-[120px]">{slot.label}</span>
                        <span className="tabular-nums text-muted-foreground">{hhmm(slot.heure_debut)} → {hhmm(slot.heure_fin)}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSlot(slot)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSlot(slot)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Dialog créneau */}
      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{slotDraft.id ? "Modifier" : "Nouveau"} créneau</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input value={slotDraft.label} onChange={(e) => setSlotDraft({ ...slotDraft, label: e.target.value })} placeholder="Matin" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="time" value={slotDraft.heure_debut} onChange={(e) => setSlotDraft({ ...slotDraft, heure_debut: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="time" value={slotDraft.heure_fin} onChange={(e) => setSlotDraft({ ...slotDraft, heure_fin: e.target.value })} />
              </div>
            </div>
            {slotDraft.heure_fin <= slotDraft.heure_debut && (
              <p className="text-xs text-amber-600">Ce créneau franchit minuit (nuit).</p>
            )}
            <div className="space-y-1.5">
              <Label>Ordre</Label>
              <Input type="number" value={slotDraft.sort_order} onChange={(e) => setSlotDraft({ ...slotDraft, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotOpen(false)}>Annuler</Button>
            <Button onClick={saveSlot} disabled={savingSlot}>{savingSlot && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

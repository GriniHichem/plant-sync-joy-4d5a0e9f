import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Loader2, Pencil, X, RotateCcw } from "lucide-react";
import { logAudit } from "@/lib/audit";

interface Team { id: string; code: string; name: string; }
interface Profile { user_id: string; first_name: string | null; last_name: string | null; poste: string | null; }
interface SystemSlot { label: string; }
interface ShiftSystem { id: string; code: string; label: string; slots: string[]; }
interface Member {
  id: string;
  user_id: string;
  role_in_team: string;
  autorisation_libre: boolean;
  is_active: boolean;
  shift_mode_id: string | null;
  cycle_pattern: string[];
  anchor_date: string | null;
  scope_kind: string;
  profile?: Profile | null;
}

const ROLES = [
  { v: "membre", l: "Membre" },
  { v: "chef", l: "Chef d'équipe" },
];
const SCOPES = [
  { v: "all", l: "Tous" },
  { v: "maintenance", l: "Maintenance" },
  { v: "quality", l: "Qualité" },
  { v: "production", l: "Production" },
];
const REPOS = "Repos";

const fullName = (p?: Profile | null) =>
  p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—" : "—";

const today = () => new Date().toISOString().slice(0, 10);

export function MembersTab() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [systems, setSystems] = useState<ShiftSystem[]>([]);
  const [loading, setLoading] = useState(false);

  // add dialog
  const [open, setOpen] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState("membre");
  const [saving, setSaving] = useState(false);

  // edit dialog (per-employee pattern)
  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [eMode, setEMode] = useState<string>("");
  const [eScope, setEScope] = useState<string>("all");
  const [eAnchor, setEAnchor] = useState<string>(today());
  const [ePattern, setEPattern] = useState<string[]>([]);
  const [eLibre, setELibre] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    (async () => {
      const [tRes, pRes, mRes, slRes] = await Promise.all([
        supabase.from("shift_teams").select("id, code, name").eq("is_active", true).order("code"),
        supabase.from("profiles").select("user_id, first_name, last_name, poste").eq("is_active", true).order("first_name"),
        supabase.from("shift_modes").select("id, code, label").eq("is_active", true).order("code"),
        supabase.from("shift_mode_slots").select("shift_mode_id, label, sort_order").order("sort_order"),
      ]);
      const t = (tRes.data as Team[]) ?? [];
      setTeams(t);
      setProfiles((pRes.data as Profile[]) ?? []);
      const slots = (slRes.data as any[]) ?? [];
      const sys = ((mRes.data as any[]) ?? []).map((m) => ({
        id: m.id, code: m.code, label: m.label,
        slots: slots.filter((s) => s.shift_mode_id === m.id).map((s) => s.label as string),
      }));
      setSystems(sys);
      if (t.length && !teamId) setTeamId(t[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMembers = async (tid: string) => {
    if (!tid) return;
    setLoading(true);
    const { data } = await supabase
      .from("shift_team_members")
      .select("id, user_id, role_in_team, autorisation_libre, is_active, shift_mode_id, cycle_pattern, anchor_date, scope_kind")
      .eq("team_id", tid);
    const rows = (data as Member[]) ?? [];
    const byUser = new Map(profiles.map((p) => [p.user_id, p]));
    setMembers(rows.map((r) => ({ ...r, cycle_pattern: r.cycle_pattern ?? [], profile: byUser.get(r.user_id) })));
    setLoading(false);
  };

  useEffect(() => { if (teamId && profiles.length) loadMembers(teamId); }, [teamId, profiles]); // eslint-disable-line

  const memberIds = new Set(members.map((m) => m.user_id));
  const available = profiles.filter((p) => !memberIds.has(p.user_id));
  const sysById = (id: string | null) => systems.find((s) => s.id === id);
  const sysLabel = (id: string | null) => sysById(id)?.label ?? "—";
  const isSurface = (id: string) => sysById(id)?.code === "surface";

  const addMember = async () => {
    if (!newUser) { toast({ title: "Sélectionnez un employé", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("shift_team_members").insert({
        team_id: teamId, user_id: newUser, role_in_team: newRole, autorisation_libre: false, is_active: true,
        scope_kind: "all", cycle_pattern: [],
      });
      if (error) throw error;
      await logAudit({ action_type: "create", module: "parametres", action: "shift_member_add", entity_type: "shift_team_members", description: "Membre ajouté à une équipe" });
      toast({ title: "Membre ajouté", description: "Configurez son système et motif de cycle." });
      setOpen(false); setNewUser(""); setNewRole("membre");
      await loadMembers(teamId);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const patch = async (m: Member, fields: Record<string, any>) => {
    const { error } = await supabase.from("shift_team_members").update(fields as any).eq("id", m.id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    await logAudit({ action_type: "update", module: "parametres", action: "shift_member_update", entity_type: "shift_team_members", entity_id: m.id, description: "Membre d'équipe modifié" });
    await loadMembers(teamId);
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setEMode(m.shift_mode_id ?? "");
    setEScope(m.scope_kind ?? "all");
    setEAnchor(m.anchor_date ?? today());
    setEPattern(m.cycle_pattern ?? []);
    setELibre(m.autorisation_libre);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editMember) return;
    if (!eMode) { toast({ title: "Système requis", variant: "destructive" }); return; }
    const surface = isSurface(eMode);
    if (!surface && ePattern.length === 0) { toast({ title: "Motif de cycle requis", description: "Ajoutez au moins un jour.", variant: "destructive" }); return; }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("shift_team_members").update({
        shift_mode_id: eMode,
        scope_kind: eScope,
        anchor_date: surface ? null : eAnchor,
        cycle_pattern: surface ? [] : ePattern,
        autorisation_libre: eLibre,
      }).eq("id", editMember.id);
      if (error) throw error;
      await logAudit({ action_type: "update", module: "parametres", action: "shift_member_pattern", entity_type: "shift_team_members", entity_id: editMember.id, description: "Motif de rotation configuré" });
      toast({ title: "Configuration enregistrée" });
      setEditOpen(false);
      await loadMembers(teamId);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setSavingEdit(false); }
  };

  const remove = async (m: Member) => {
    if (!confirm(`Retirer ${fullName(m.profile)} de l'équipe ?`)) return;
    const { error } = await supabase.from("shift_team_members").delete().eq("id", m.id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    await logAudit({ action_type: "delete", module: "parametres", action: "shift_member_remove", entity_type: "shift_team_members", entity_id: m.id, description: "Membre retiré d'une équipe" });
    toast({ title: "Membre retiré" });
    await loadMembers(teamId);
  };

  const editSurface = eMode ? isSurface(eMode) : false;
  const editSlots = sysById(eMode)?.slots ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="space-y-1.5 w-64">
          <Label>Équipe</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger><SelectValue placeholder="Choisir une équipe" /></SelectTrigger>
            <SelectContent>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!teamId}><UserPlus className="h-4 w-4 mr-2" /> Ajouter un membre</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajouter un membre</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Employé</Label>
                <Select value={newUser} onValueChange={setNewUser}>
                  <SelectTrigger><SelectValue placeholder="Choisir un employé" /></SelectTrigger>
                  <SelectContent>
                    {available.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {fullName(p)}{p.poste ? ` · ${p.poste}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rôle dans l'équipe</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Le système et le motif de cycle se configurent ensuite via l'icône d'édition.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={addMember} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Ajouter</Button>
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
              <TableHead>Employé</TableHead>
              <TableHead>Système</TableHead>
              <TableHead>Motif de cycle</TableHead>
              <TableHead>Ancrage</TableHead>
              <TableHead>Périmètre</TableHead>
              <TableHead>Auth. libre</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{fullName(m.profile)}</TableCell>
                <TableCell>{m.shift_mode_id ? <Badge variant="outline">{sysLabel(m.shift_mode_id)}</Badge> : <span className="text-muted-foreground text-xs">Non configuré</span>}</TableCell>
                <TableCell className="text-xs max-w-[220px]">
                  {m.shift_mode_id && isSurface(m.shift_mode_id)
                    ? <span className="text-muted-foreground">5/7 fixe (Lun-Ven)</span>
                    : m.cycle_pattern?.length
                      ? <span className="tabular-nums">{m.cycle_pattern.join(" · ")}</span>
                      : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs tabular-nums">{m.anchor_date ?? (m.shift_mode_id && isSurface(m.shift_mode_id) ? "—" : "—")}</TableCell>
                <TableCell><Badge variant="secondary">{SCOPES.find((s) => s.v === m.scope_kind)?.l ?? m.scope_kind}</Badge></TableCell>
                <TableCell>
                  <Switch checked={m.autorisation_libre} onCheckedChange={(v) => patch(m, { autorisation_libre: v })} />
                </TableCell>
                <TableCell>
                  <Switch checked={m.is_active} onCheckedChange={(v) => patch(m, { is_active: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun membre dans cette équipe.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Edit pattern dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Configurer la rotation — {fullName(editMember?.profile)}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Système de production</Label>
                <Select value={eMode} onValueChange={setEMode}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Périmètre</Label>
                <Select value={eScope} onValueChange={setEScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editSurface ? (
              <p className="text-sm text-muted-foreground border rounded-md p-3">
                Système <strong>Surface</strong> : logique fixe calendaire <strong>5/7</strong>. Travail du lundi au vendredi (journée), repos samedi &amp; dimanche. Aucun motif ni date d'ancrage requis.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Date d'ancrage (début du cycle)</Label>
                  <Input type="date" value={eAnchor} onChange={(e) => setEAnchor(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Motif de cycle ({ePattern.length} jour{ePattern.length > 1 ? "s" : ""})</Label>
                    {ePattern.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEPattern([])}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Vider
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Cliquez pour ajouter un jour. Le motif boucle indéfiniment depuis la date d'ancrage.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {editSlots.map((s) => (
                      <Button key={s} type="button" size="sm" variant="outline" onClick={() => setEPattern((p) => [...p, s])}>+ {s}</Button>
                    ))}
                    <Button type="button" size="sm" variant="outline" onClick={() => setEPattern((p) => [...p, REPOS])}>+ {REPOS}</Button>
                    {editSlots.length === 0 && eMode && <span className="text-xs text-muted-foreground">Ce système n'a aucun créneau défini.</span>}
                  </div>
                  {ePattern.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border rounded-md p-2 bg-muted/30">
                      {ePattern.map((s, i) => (
                        <Badge key={i} variant={s === REPOS ? "secondary" : "default"} className="gap-1">
                          <span className="opacity-60">J{i + 1}</span> {s}
                          <button onClick={() => setEPattern((p) => p.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Switch checked={eLibre} onCheckedChange={setELibre} />
              <Label>Autorisation libre (auto-ouverture de session)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>{savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

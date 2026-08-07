import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, RotateCcw, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditFilters } from "@/hooks/useAuditLogs";

const NONE = "__none__";

const MODULES = [
  "auth","users","roles","permissions",
  "machines","equipements","organes","lignes",
  "pdr","pdr_stock",
  "tickets","interventions","preventif",
  "gpao","of","produits","articles","recettes",
  "consommations","arrets",
  "documents","images",
  "parametres","audit","system",
];

const ACTION_TYPES = [
  "login","logout","login_failed","password_reset","password_change",
  "create","update","delete","status_change",
  "role_change","permission_change",
  "stock_entry","stock_exit","stock_inventory","stock_correction","stock_movement_cancel",
  "production_declaration","production_correction",
  "consumption_declaration","consumption_correction",
  "of_create","of_update","of_cancel","of_mode_change",
  "ticket_create","ticket_update","ticket_close","ticket_resolve",
  "intervention_create","intervention_update",
  "preventive_create","preventive_validate","preventive_execute","preventive_suspend",
  "document_upload","document_download","document_delete","document_metadata_update",
  "image_upload","image_delete","image_set_primary",
  "import_csv","export_csv",
  "access_denied","error",
];

const STATUSES = ["success","failed","denied","warning"];
const SEVERITIES = ["info","low","medium","high","critical"];
const SOURCES = ["app","auth","database","edge_function","system"];

interface UserOpt { id: string; label: string }

interface Props {
  filters: AuditFilters;
  onChange: (f: AuditFilters) => void;
  onReset: () => void;
  canViewArchives?: boolean;
}

export function AuditFilters({ filters, onChange, onReset, canViewArchives }: Props) {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.search ?? "");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .limit(500)
      .then(({ data }) => {
        if (data) {
          setUsers(
            data
              .map((p) => ({
                id: p.user_id,
                label: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.user_id.slice(0, 8),
              }))
              .sort((a, b) => a.label.localeCompare(b.label))
          );
        }
      });
  }, []);

  useEffect(() => { setLocalSearch(filters.search ?? ""); }, [filters.search]);

  const set = (patch: Partial<AuditFilters>) => onChange({ ...filters, ...patch });
  const valOrNone = (v?: string) => v && v !== "" ? v : NONE;
  const noneOrVal = (v: string) => v === NONE ? undefined : v;

  const hasActiveFilters =
    !!filters.dateFrom || !!filters.dateTo || !!filters.userId ||
    !!filters.module || !!filters.actionType || !!filters.status ||
    !!filters.severity || !!filters.entityType || !!filters.entityCode ||
    !!filters.source || !!(filters.search?.trim()) || !!filters.includeArchived;

  return (
    <Card className="p-3 space-y-3">
      {/* top row : search + buttons */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") set({ search: localSearch }); }}
            placeholder="Rechercher (utilisateur, description, code entité...)"
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => set({ search: localSearch })} className="h-10 gap-2">
            <Search size={15} /> Rechercher
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen((o) => !o)}
            className="h-10 gap-2"
          >
            <Filter size={15} />
            Filtres
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={onReset} className="h-10 gap-2 text-muted-foreground">
              <RotateCcw size={15} /> Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* advanced filters */}
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t">
          <div className="space-y-1.5">
            <Label className="text-xs">Date début</Label>
            <Input type="date" value={filters.dateFrom ?? ""} onChange={(e) => set({ dateFrom: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date fin</Label>
            <Input type="date" value={filters.dateTo ?? ""} onChange={(e) => set({ dateTo: e.target.value || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Utilisateur</Label>
            <Select value={valOrNone(filters.userId)} onValueChange={(v) => set({ userId: noneOrVal(v) })}>
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tous</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Module</Label>
            <Select value={valOrNone(filters.module)} onValueChange={(v) => set({ module: noneOrVal(v) })}>
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tous</SelectItem>
                {MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type d'action</Label>
            <Select value={valOrNone(filters.actionType)} onValueChange={(v) => set({ actionType: noneOrVal(v) })}>
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value={NONE}>Tous</SelectItem>
                {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Statut</Label>
            <Select value={valOrNone(filters.status)} onValueChange={(v) => set({ status: noneOrVal(v) })}>
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tous</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sévérité</Label>
            <Select value={valOrNone(filters.severity)} onValueChange={(v) => set({ severity: noneOrVal(v) })}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Toutes</SelectItem>
                {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Select value={valOrNone(filters.source)} onValueChange={(v) => set({ source: noneOrVal(v) })}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Toutes</SelectItem>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type entité</Label>
            <Input value={filters.entityType ?? ""} onChange={(e) => set({ entityType: e.target.value || undefined })} placeholder="ex: machine, pdr..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Code entité</Label>
            <Input value={filters.entityCode ?? ""} onChange={(e) => set({ entityCode: e.target.value || undefined })} placeholder="ex: TKT-00012" />
          </div>
          {canViewArchives && (
            <div className="space-y-1.5 flex flex-col">
              <Label className="text-xs">Inclure archives</Label>
              <div className="flex items-center h-10 gap-2">
                <Switch checked={!!filters.includeArchived} onCheckedChange={(v) => set({ includeArchived: v })} />
                <span className="text-xs text-muted-foreground">Afficher les logs archivés</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

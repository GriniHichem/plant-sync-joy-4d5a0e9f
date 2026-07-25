import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllRoles } from "@/hooks/useAllRoles";
import { LANDING_MODULES } from "@/lib/landing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Home } from "lucide-react";

// Sentinel value for the Radix Select "Auto" option — Radix forbids empty strings.
const AUTO = "__auto__";

interface RolePermRow {
  role: string;
  module: string;
  can_view: boolean;
}

/**
 * Admin config: per-role default landing page.
 * Stored in app_settings.value (JSON) under key `landing.defaults_by_role`.
 * Only landing modules where the role has `can_view = true` are proposed —
 * so an admin cannot pick a page the role could not open anyway.
 */
export default function LandingPagesTab() {
  const { roles, loading: rolesLoading } = useAllRoles();
  const { toast } = useToast();
  const [permsByRole, setPermsByRole] = useState<Record<string, Set<string>>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [permsRes, settingRes] = await Promise.all([
        supabase.from("role_permissions").select("role, module, can_view"),
        supabase.from("app_settings").select("value").eq("key", "landing.defaults_by_role").maybeSingle(),
      ]);
      const map: Record<string, Set<string>> = {};
      for (const row of (permsRes.data ?? []) as RolePermRow[]) {
        if (!row.can_view) continue;
        if (!map[row.role]) map[row.role] = new Set();
        map[row.role].add(row.module);
      }
      setPermsByRole(map);
      let parsed: Record<string, string> = {};
      try {
        parsed = settingRes.data?.value ? JSON.parse(settingRes.data.value as unknown as string) : {};
      } catch { parsed = {}; }
      setOverrides(parsed);
      setInitial(parsed);
      setLoading(false);
    })();
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(overrides) !== JSON.stringify(initial),
    [overrides, initial],
  );

  const optionsForRole = (roleCode: string) => {
    const allowed = permsByRole[roleCode] ?? new Set<string>();
    return LANDING_MODULES.filter((m) => allowed.has(m.module));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "landing.defaults_by_role", value: JSON.stringify(overrides) }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setInitial(overrides);
    toast({ title: "Page d'accueil enregistrée", description: "Les utilisateurs verront la nouvelle page à leur prochaine connexion." });
  };

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
        <Home className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium">Page d'accueil par rôle</p>
          <p className="text-muted-foreground">
            À la connexion, chaque utilisateur est redirigé vers la page définie ici pour son rôle.
            En mode <em>Automatique</em>, le système choisit le module accessible où le rôle a le plus de droits.
            Seuls les modules avec droit <strong>Voir</strong> sont proposés — un utilisateur ne verra jamais une page qu'il ne peut pas ouvrir.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {roles.map((r) => {
              const opts = optionsForRole(r.code);
              const current = overrides[r.code] ?? "";
              return (
                <div key={r.code} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3">
                  <div className="flex items-center gap-2 min-w-0 sm:w-64">
                    <span className="font-medium text-sm truncate">{r.label}</span>
                    {r.isCustom && <Badge variant="outline" className="text-[9px]">perso.</Badge>}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <Select
                      value={current || AUTO}
                      onValueChange={(v) => {
                        setOverrides((prev) => {
                          const next = { ...prev };
                          if (v === AUTO) delete next[r.code];
                          else next[r.code] = v;
                          return next;
                        });
                      }}
                      disabled={opts.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={opts.length === 0 ? "Aucun module accessible" : "Automatique"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO}>Automatique (meilleur module)</SelectItem>
                        {opts.map((o) => (
                          <SelectItem key={o.path} value={o.path}>
                            {o.label} <span className="text-muted-foreground text-xs ml-1">— {o.path}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => setOverrides(initial)}
        >
          <RotateCcw className="h-4 w-4 mr-1" /> Annuler
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

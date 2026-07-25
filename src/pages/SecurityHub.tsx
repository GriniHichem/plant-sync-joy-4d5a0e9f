import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Users, FileText, Package, ClipboardCheck, CheckSquare,
  Activity, ToggleLeft, Download, LayoutGrid, Search, ChevronRight, Lock, Truck, Home,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import RolesTab from "./parametres/access-control/RolesTab";
import QualityPermissionsTab from "./parametres/access-control/QualityPermissionsTab";
import ReceptionPermissionsTab from "./parametres/access-control/ReceptionPermissionsTab";
import AuditControlTab from "./parametres/access-control/AuditControlTab";
import ControlSwitchesTab from "./parametres/access-control/ControlSwitchesTab";
import PortabilityTab from "./parametres/access-control/PortabilityTab";
import RolesMatrix from "./parametres/RolesMatrix";
import DocumentPermissionsAdmin from "./parametres/DocumentPermissionsAdmin";
import PdrStockPermissionsAdmin from "./parametres/PdrStockPermissionsAdmin";
import LandingPagesTab from "./parametres/access-control/LandingPagesTab";

type SectionKey =
  | "overview" | "users" | "roles" | "matrix" | "landing" | "documents" | "pdr"
  | "quality" | "reception" | "validations" | "audit" | "control" | "portability";

interface SectionDef {
  key: SectionKey;
  label: string;
  description: string;
  icon: React.ElementType;
  group: "Vue" | "Identités" | "Permissions" | "Gouvernance" | "Système";
  accent: string;
}

const SECTIONS: SectionDef[] = [
  { key: "overview", label: "Vue d'ensemble", description: "Statistiques et raccourcis clés", icon: LayoutGrid, group: "Vue", accent: "from-sky-500/15 to-sky-500/5 text-sky-500" },
  { key: "users", label: "Utilisateurs", description: "Comptes, rôles assignés et statut", icon: Users, group: "Identités", accent: "from-blue-500/15 to-blue-500/5 text-blue-500" },
  { key: "roles", label: "Rôles", description: "Rôles système et personnalisés", icon: ShieldCheck, group: "Identités", accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-500" },
  { key: "matrix", label: "Matrice modules", description: "Permissions par rôle × module", icon: LayoutGrid, group: "Permissions", accent: "from-violet-500/15 to-violet-500/5 text-violet-500" },
  { key: "landing", label: "Page d'accueil", description: "Module par défaut à la connexion, par rôle", icon: Home, group: "Permissions", accent: "from-cyan-500/15 to-cyan-500/5 text-cyan-500" },
  { key: "documents", label: "Documents", description: "Droits d'accès aux documents", icon: FileText, group: "Permissions", accent: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-500" },
  { key: "pdr", label: "PDR & Stock", description: "Mouvements, inventaires, fournisseurs", icon: Package, group: "Permissions", accent: "from-amber-500/15 to-amber-500/5 text-amber-500" },
  { key: "quality", label: "Qualité", description: "15 droits granulaires qualité", icon: ClipboardCheck, group: "Permissions", accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-500" },
  { key: "reception", label: "Réception", description: "Qualitative, quantitative, global, settings", icon: Truck, group: "Permissions", accent: "from-lime-500/15 to-lime-500/5 text-lime-500" },
  { key: "validations", label: "Workflows", description: "Validations & notifications", icon: CheckSquare, group: "Gouvernance", accent: "from-teal-500/15 to-teal-500/5 text-teal-500" },
  { key: "audit", label: "Audit & Contrôle", description: "Audit par rôle / module", icon: Activity, group: "Gouvernance", accent: "from-rose-500/15 to-rose-500/5 text-rose-500" },
  { key: "control", label: "Système", description: "Interrupteurs globaux", icon: ToggleLeft, group: "Système", accent: "from-orange-500/15 to-orange-500/5 text-orange-500" },
  { key: "portability", label: "Portabilité", description: "Export JSON/SQL — self-hosting", icon: Download, group: "Système", accent: "from-slate-500/15 to-slate-500/5 text-slate-400" },
];

const GROUPS: SectionDef["group"][] = ["Vue", "Identités", "Permissions", "Gouvernance", "Système"];

interface Stats {
  customRoles: number;
  rolePerms: number;
  qualityPerms: number;
  users: number;
}

import UsersAdmin from "./parametres/UsersAdmin";

export default function SecurityHub() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initial = (params.get("section") as SectionKey) || "overview";
  const [active, setActive] = useState<SectionKey>(initial);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<Stats>({ customRoles: 0, rolePerms: 0, qualityPerms: 0, users: 0 });

  useEffect(() => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("section", active);
      return np;
    }, { replace: true });
  }, [active, setParams]);

  useEffect(() => {
    (async () => {
      const [cr, rp, qp, u] = await Promise.all([
        supabase.from("custom_roles" as any).select("id", { count: "exact", head: true }),
        supabase.from("role_permissions").select("id", { count: "exact", head: true }),
        supabase.from("quality_permissions" as any).select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }),
      ]);
      setStats({
        customRoles: cr.count ?? 0,
        rolePerms: rp.count ?? 0,
        qualityPerms: qp.count ?? 0,
        users: u.count ?? 0,
      });
    })();
  }, []);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS.filter((s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [search]);

  const current = SECTIONS.find((s) => s.key === active)!;

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sécurité & Accès</h1>
              <p className="text-sm text-muted-foreground">
                Hub centralisé : utilisateurs, rôles, permissions granulaires, audit, contrôles globaux et self-hosting.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <StatPill label="Utilisateurs" value={stats.users} onClick={() => setActive("users")} />
            <StatPill label="Rôles perso." value={stats.customRoles} onClick={() => setActive("roles")} />
            <StatPill label="Permissions" value={stats.rolePerms} onClick={() => setActive("matrix")} />
            <StatPill label="Profils qualité" value={stats.qualityPerms} onClick={() => setActive("quality")} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Sidebar navigation */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une section..."
              className="pl-9 h-10"
            />
          </div>
          <Card>
            <CardContent className="p-2">
              {GROUPS.map((g) => {
                const items = filteredSections.filter((s) => s.group === g);
                if (!items.length) return null;
                return (
                  <div key={g} className="py-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
                      {g}
                    </div>
                    {items.map((s) => {
                      const Icon = s.icon;
                      const isActive = s.key === active;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setActive(s.key)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all",
                            "hover:bg-accent/60",
                            isActive && "bg-primary/10 text-primary font-semibold"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                          <span className="flex-1 truncate">{s.label}</span>
                          {isActive && <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/parametres")}>
            ← Retour aux paramètres
          </Button>
        </aside>

        {/* Content */}
        <main className="space-y-4 min-w-0">
          <div className="flex items-center gap-3 px-1">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br border border-border/40", current.accent)}>
              <current.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{current.label}</h2>
              <p className="text-xs text-muted-foreground truncate">{current.description}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-1 md:p-2">
            <div className="p-3 md:p-4">
              {active === "overview" && <OverviewPanel onJump={setActive} />}
              {active === "users" && <UsersAdmin />}
              {active === "roles" && <RolesTab />}
              {active === "matrix" && <RolesMatrix />}
              {active === "landing" && <LandingPagesTab />}
              {active === "documents" && <DocumentPermissionsAdmin />}
              {active === "pdr" && <PdrStockPermissionsAdmin />}
              {active === "quality" && <QualityPermissionsTab />}
              {active === "reception" && <ReceptionPermissionsTab />}
              {active === "validations" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Configuration des règles de validation et de notification.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => navigate("/parametres/validations")}>Règles de validation</Button>
                    <Button variant="outline" onClick={() => navigate("/parametres/notifications")}>Règles de notification</Button>
                  </div>
                </div>
              )}
              {active === "audit" && <AuditControlTab />}
              {active === "control" && <ControlSwitchesTab />}
              {active === "portability" && <PortabilityTab />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatPill({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border bg-card/80 backdrop-blur px-3 py-2 text-left hover:border-primary/40 hover:bg-card transition-colors"
    >
      <div className="text-xl font-bold text-primary leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </button>
  );
}

function OverviewPanel({ onJump }: { onJump: (k: SectionKey) => void }) {
  const quick = SECTIONS.filter((s) => s.key !== "overview");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sélectionnez une section pour configurer les accès. Toutes les modifications sont auditées et compatibles self-hosting.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quick.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => onJump(s.key)}
              className={cn(
                "group text-left p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-gradient-to-br border border-border/40 shrink-0", s.accent)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{s.label}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{s.group}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

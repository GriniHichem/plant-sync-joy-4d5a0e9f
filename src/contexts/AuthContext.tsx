import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/audit";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type AppRole = "admin" | "resp_maintenance" | "maintenancier" | "resp_production" | "chef_ligne" | "operateur" | "gestionnaire_magasin" | "responsable_magasin" | "bureau_methode" | "responsable_si" | "auditeur" | "controleur_qualite" | "responsable_controle_qualite" | "directeur_qualite" | "responsable_inventaire" | "agent_inventaire" | "agreeur" | "agent_pont_bascule";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  poste: string | null;
  avatar_url: string | null;
  public_access?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  realRoles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isImpersonating: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [realProfile, setRealProfile] = useState<Profile | null>(null);
  const [realRoles, setRealRoles] = useState<AppRole[]>([]);
  const [customRoleInherits, setCustomRoleInherits] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const { impersonation } = useImpersonation();

  // Load the custom_roles → inherits_from map once. Custom roles behave like
  // their inherited system role for hardcoded hasRole() feature-gates, WITHOUT
  // accumulating matrix rights (usePermissions still queries only the assigned
  // role codes, so role_permissions rows remain the single source of truth).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("custom_roles" as any)
        .select("code, inherits_from, is_active");
      if (cancelled || !data) return;
      const map: Record<string, string | null> = {};
      for (const r of data as any[]) {
        if (r.is_active) map[r.code] = r.inherits_from ?? null;
      }
      setCustomRoleInherits(map);
    })();
    return () => { cancelled = true; };
  }, []);


  useEffect(() => {
    let lastUserId: string | null = null;
    let bootstrapped = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      const uid = session?.user?.id ?? null;

      if (!uid) {
        lastUserId = null;
        setRealProfile(null);
        setRealRoles([]);
        return;
      }

      // Public-access gate ONLY on an actual fresh SIGNED_IN event (user just
      // typed their credentials). Never on INITIAL_SESSION, TOKEN_REFRESHED,
      // USER_UPDATED, or getSession() bootstrap — those fire on every mount /
      // HMR / tab focus and were signing people out mid-work.
      const runGate = event === "SIGNED_IN" && bootstrapped;
      const userChanged = uid !== lastUserId;
      lastUserId = uid;

      setTimeout(() => {
        if (userChanged) {
          fetchProfile(uid, runGate);
          fetchRoles(uid);
        }
        if (event === "SIGNED_IN") {
          logAuthEvent("login", { email: session!.user.email ?? undefined });
        } else if (event === "PASSWORD_RECOVERY") {
          logAuthEvent("password_reset", { email: session!.user.email ?? undefined });
        }
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Avoid double-fetch if onAuthStateChange already handled this uid.
        if (lastUserId !== session.user.id) {
          lastUserId = session.user.id;
          fetchProfile(session.user.id, false);
          fetchRoles(session.user.id);
        }
      }
      bootstrapped = true;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, runGate: boolean = false) {
    // maybeSingle() so a missing profile row does NOT throw and leave the UI stuck
    // showing just "utilisateur". This is common right after signup on self-hosting
    // if the auto-create trigger did not run.
    const { data, error } = await (supabase
      .from("profiles")
      .select("*") as any)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Do not clear roles/profile on transient errors — keep the previous state.
      // eslint-disable-next-line no-console
      console.warn("[Auth] fetchProfile failed:", error.message);
      return;
    }

    if (data) {
      setRealProfile(data as any as Profile);
    } else {
      // Fallback: keep a minimal profile so the app can render menus/roles.
      setRealProfile((prev) => prev ?? ({
        id: userId,
        user_id: userId,
        first_name: "",
        last_name: "",
        poste: null,
        avatar_url: null,
      } as Profile));
    }

    if (!runGate || !data) return;
    // Note: The public access gate is currently disabled to ensure login accessibility
    // across all environments during the transition.
    return;
  }

  async function fetchRoles(userId: string) {
    const { data, error } = await (supabase
      .from("user_roles")
      .select("role") as any)
      .eq("user_id", userId);
    if (error) {
      // Never wipe roles on a transient error — the user would lose module access.
      // eslint-disable-next-line no-console
      console.warn("[Auth] fetchRoles failed:", error.message);
      return;
    }
    setRealRoles((data ?? []).map((r: any) => r.role as AppRole));
  }

  // Effective values: when impersonating, override roles & profile
  const effectiveRoles: AppRole[] = useMemo(
    () => (impersonation ? (impersonation.targetRoles as AppRole[]) : realRoles),
    [impersonation, realRoles],
  );

  const effectiveProfile: Profile | null = impersonation && impersonation.targetProfile
    ? {
        id: impersonation.targetProfile.user_id,
        user_id: impersonation.targetProfile.user_id,
        first_name: impersonation.targetProfile.first_name ?? "",
        last_name: impersonation.targetProfile.last_name ?? "",
        poste: impersonation.targetProfile.poste,
        avatar_url: impersonation.targetProfile.avatar_url,
      }
    : realProfile;

  // Feature-gate hasRole(): matches assigned roles + the system role each
  // custom role inherits from. Matrix permissions are still evaluated per
  // assigned role code only (no rights cumulation) — see usePermissions.
  const hasRole = (role: AppRole) => {
    if (effectiveRoles.includes(role)) return true;
    for (const r of effectiveRoles) {
      const inherited = customRoleInherits[r as unknown as string];
      if (inherited && inherited === (role as unknown as string)) return true;
    }
    return false;
  };


  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    try { await logAuthEvent("logout", { email: user?.email ?? undefined }); } catch { /* ignore */ }
    // Local scope: clears session in this browser without needing the auth server
    // to respond (critical for self-hosting when /logout is slow/unreachable).
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      // Fallback: purge storage manually so the UI never stays stuck logged in.
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") || k === "sb-prodintime-auth")
          .forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
    }
    setUser(null);
    setSession(null);
    setRealProfile(null);
    setRealRoles([]);
    // Force a clean reload to /auth so any stale in-memory state is dropped.
    try {
      if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
        window.location.assign("/auth");
      }
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile: effectiveProfile,
      roles: effectiveRoles,
      realRoles,
      loading,
      hasRole,
      isImpersonating: !!impersonation,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

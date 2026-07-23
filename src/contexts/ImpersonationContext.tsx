import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { installImpersonationGuard, uninstallImpersonationGuard } from "@/lib/impersonationGuard";

type AppRole = string;

interface TargetProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  poste: string | null;
  avatar_url: string | null;
}

interface ImpersonationState {
  targetUserId: string;
  targetProfile: TargetProfile | null;
  targetRoles: AppRole[];
}

interface ImpersonationContextType {
  impersonation: ImpersonationState | null;
  loading: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

const SS_KEY = "impersonation_target_user_id";

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTarget = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, poste, avatar_url").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      const state: ImpersonationState = {
        targetUserId: userId,
        targetProfile: (profile as TargetProfile | null) ?? { user_id: userId, first_name: null, last_name: null, poste: null, avatar_url: null },
        targetRoles: (roles ?? []).map((r: any) => r.role as AppRole),
      };
      setImpersonation(state);
      installImpersonationGuard();
      sessionStorage.setItem(SS_KEY, userId);
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore from sessionStorage on mount — ONLY if the current authenticated
  // user is actually an admin. Otherwise any stale key (shared kiosk, previous
  // admin session, duplicated tab) would make an operator suddenly see another
  // user's roles/profile. This was the root cause of "l'interface bascule sur
  // les permissions d'un autre utilisateur".
  useEffect(() => {
    const stored = sessionStorage.getItem(SS_KEY);
    if (!stored) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          sessionStorage.removeItem(SS_KEY);
          return;
        }
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
        if (!isAdmin) {
          // Purge silently — non-admin must never impersonate.
          sessionStorage.removeItem(SS_KEY);
          return;
        }
        await loadTarget(stored);
      } catch {
        sessionStorage.removeItem(SS_KEY);
      }
    })();
  }, [loadTarget]);

  const startImpersonation = useCallback(async (userId: string) => {
    await loadTarget(userId);
  }, [loadTarget]);

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(SS_KEY);
    uninstallImpersonationGuard();
    setImpersonation(null);
  }, []);

  return (
    <ImpersonationContext.Provider value={{ impersonation, loading, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

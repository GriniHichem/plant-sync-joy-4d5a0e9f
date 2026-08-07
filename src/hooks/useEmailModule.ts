import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: string | null;
  display_name: string | null;
  is_connected: boolean;
  connected_at: string | null;
  last_error: string | null;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  is_html: boolean;
  default_recipients: string | null;
  variables: string[];
  description: string | null;
}

export interface EmailLog {
  id: string;
  template_name: string | null;
  template_id: string | null;
  from_email: string | null;
  sent_to: string[];
  cc: string[];
  subject: string;
  body: string | null;
  is_html: boolean;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

const FN = "user-email";

async function invoke(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(FN, { body: payload });
  if (error) {
    let detail = error.message;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const txt = await ctx.text();
        const parsed = JSON.parse(txt);
        detail = parsed?.error || txt || detail;
      } catch { /* keep default */ }
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data as Record<string, unknown>;
}

/** Compte email de l'utilisateur courant (connexion / déconnexion). */
export function useEmailAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<EmailAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_email_accounts")
      .select("id, email, provider, smtp_host, smtp_port, smtp_secure, display_name, is_connected, connected_at, last_error")
      .eq("user_id", user.id)
      .maybeSingle();
    setAccount((data as EmailAccount) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = useCallback(async (input: {
    email: string; password: string; provider: string;
    smtp_host?: string; smtp_port?: number; smtp_secure?: string; display_name?: string;
  }) => {
    await invoke({ action: "connect", ...input });
    await refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    await invoke({ action: "disconnect" });
    await refresh();
  }, [refresh]);

  return { account, loading, refresh, connect, disconnect, isConnected: !!account?.is_connected };
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("id, name, category, subject, body, is_html, default_recipients, variables, description")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (cancelled) return;
      setTemplates((data as EmailTemplate[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { templates, loading };
}

export function useEmailLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("email_logs")
      .select("id, template_name, template_id, from_email, sent_to, cc, subject, body, is_html, status, error_message, sent_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs((data as EmailLog[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { logs, loading, refresh };
}

export async function sendEmail(input: {
  to: string; cc?: string; subject: string; body: string; is_html?: boolean;
  template_id?: string | null; template_name?: string | null;
  attachments?: { filename: string; url: string }[];
}) {
  return invoke({ action: "send", ...input });
}


/** Remplace les variables {{cle}} par les valeurs fournies. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? `{{${key}}}`);
}

export function extractVariables(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) out.add(m[1]);
  return Array.from(out);
}

export const CATEGORY_LABELS: Record<string, string> = {
  qualite: "Qualité",
  production: "Production",
  maintenance: "Maintenance",
  reception: "Réception F&L",
  achats: "Achats & approvisionnements",
  general: "Général",
};


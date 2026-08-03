import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PROVIDERS: Record<string, { host: string; port: number; secure: string }> = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: "ssl" },
  outlook: { host: "smtp.office365.com", port: 587, secure: "tls" },
};

/** AES-GCM key derived from the project secret. */
async function encKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("EMAIL_ENC_KEY") || "";
  if (!raw) throw new Error("Chiffrement non configuré (EMAIL_ENC_KEY manquant)");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encKey();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${b64(iv)}.${b64(ct)}`;
}

async function decrypt(payload: string): Promise<string> {
  const [ivPart, ctPart] = payload.split(".");
  if (!ivPart || !ctPart) throw new Error("Identifiants email illisibles, reconnectez votre compte");
  const key = await encKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivPart) },
    key,
    unb64(ctPart),
  );
  return new TextDecoder().decode(pt);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(input: unknown): string[] {
  const list = Array.isArray(input) ? input : String(input ?? "").split(/[;,\n]/);
  return list.map((r) => String(r).trim()).filter(Boolean);
}

function smtpErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("535") || m.includes("auth") || m.includes("credential")) {
    return "Identifiants refusés par le serveur email. Pour Gmail/Outlook, utilisez un mot de passe d'application.";
  }
  if (m.includes("timed out") || m.includes("timeout")) return "Serveur SMTP injoignable (délai dépassé).";
  if (m.includes("dns") || m.includes("resolve") || m.includes("connection refused")) {
    return "Serveur SMTP indisponible ou adresse du serveur incorrecte.";
  }
  if (m.includes("recipient") || m.includes("550")) return "Adresse email destinataire invalide ou refusée.";
  return raw;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Utilisateur non authentifié" }, 401);

    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---- Connexion d'un compte email ----------------------------------------
    if (action === "connect") {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      const provider = String(body.provider || "custom");
      if (!EMAIL_RE.test(email)) return json({ error: "Adresse email invalide" }, 400);
      if (!password) return json({ error: "Mot de passe requis" }, 400);

      const preset = PROVIDERS[provider];
      const host = String(body.smtp_host || preset?.host || "").trim();
      const port = Number(body.smtp_port || preset?.port || 587);
      const secure = String(body.smtp_secure || preset?.secure || "tls");
      if (!host) return json({ error: "Serveur SMTP requis pour un compte personnalisé" }, 400);

      // Vérification réelle des identifiants
      try {
        const client = new SMTPClient({
          connection: { hostname: host, port, tls: secure === "ssl" || port === 465, auth: { username: email, password } },
        });
        await client.send({ from: email, to: email, subject: "Vérification de connexion", content: "Connexion vérifiée." });
        await client.close();
      } catch (e) {
        const msg = smtpErrorMessage(e instanceof Error ? e.message : String(e));
        await admin.from("user_email_accounts").upsert({
          user_id: user.id, email, provider, smtp_host: host, smtp_port: port,
          smtp_secure: secure, is_connected: false, last_error: msg,
        }, { onConflict: "user_id" });
        return json({ error: msg }, 400);
      }

      const { error } = await admin.from("user_email_accounts").upsert({
        user_id: user.id,
        email,
        encrypted_password: await encrypt(password),
        provider,
        smtp_host: host,
        smtp_port: port,
        smtp_secure: secure,
        display_name: body.display_name ? String(body.display_name) : null,
        is_connected: true,
        connected_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, email, provider });
    }

    // ---- Déconnexion --------------------------------------------------------
    if (action === "disconnect") {
      const { error } = await admin.from("user_email_accounts").delete().eq("user_id", user.id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- Envoi --------------------------------------------------------------
    if (action === "send") {
      const to = parseRecipients(body.to);
      const cc = parseRecipients(body.cc);
      const subject = String(body.subject || "").trim();
      const html = String(body.body || "");
      const isHtml = body.is_html !== false;
      const attachmentsIn = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];

      if (to.length === 0) return json({ error: "Au moins un destinataire est requis" }, 400);
      const bad = [...to, ...cc].find((a) => !EMAIL_RE.test(a));
      if (bad) return json({ error: `Adresse email invalide : ${bad}` }, 400);
      if (!subject) return json({ error: "L'objet est requis" }, 400);
      if (!html.trim()) return json({ error: "Le corps du message est requis" }, 400);

      // Pièces jointes : téléchargées depuis leur URL (photos PDR, etc.)
      const attachments: Record<string, unknown>[] = [];
      for (const a of attachmentsIn as { filename?: string; url?: string }[]) {
        const url = String(a?.url || "");
        if (!/^https?:\/\//i.test(url)) continue;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.byteLength > 8 * 1024 * 1024) continue;
          let bin = "";
          for (let i = 0; i < buf.length; i += 8192) {
            bin += String.fromCharCode(...buf.subarray(i, i + 8192));
          }
          attachments.push({
            filename: String(a?.filename || "piece-jointe"),
            content: btoa(bin),
            encoding: "base64",
            contentType: res.headers.get("content-type") || "application/octet-stream",
          });
        } catch { /* ignore une pièce jointe illisible */ }
      }


      const { data: account } = await admin
        .from("user_email_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!account || !account.is_connected || !account.encrypted_password) {
        return json({ error: "Veuillez connecter votre compte email avant d'envoyer un message", code: "not_connected" }, 409);
      }

      const logBase = {
        user_id: user.id,
        template_id: body.template_id ?? null,
        template_name: body.template_name ?? null,
        from_email: account.email,
        sent_to: to,
        cc,
        subject,
        body: html,
        is_html: isHtml,
      };

      try {
        const password = await decrypt(account.encrypted_password);
        const port = Number(account.smtp_port || 587);
        const client = new SMTPClient({
          connection: {
            hostname: account.smtp_host,
            port,
            tls: account.smtp_secure === "ssl" || port === 465,
            auth: { username: account.email, password },
          },
        });
        const from = account.display_name ? `${account.display_name} <${account.email}>` : account.email;
        const payload: Record<string, unknown> = { from, to, subject };
        if (cc.length) payload.cc = cc;
        if (attachments.length) payload.attachments = attachments;

        if (isHtml) {
          payload.html = html;
          payload.content = "Veuillez utiliser un client email supportant le HTML.";
        } else {
          payload.content = html;
        }
        await client.send(payload as never);
        await client.close();
      } catch (e) {
        const msg = smtpErrorMessage(e instanceof Error ? e.message : String(e));
        await admin.from("email_logs").insert({ ...logBase, status: "failed", error_message: msg });
        return json({ error: msg }, 400);
      }

      await admin.from("email_logs").insert({ ...logBase, status: "sent", sent_at: new Date().toISOString() });
      return json({ success: true, sent_to: to });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("user-email error:", msg);
    return json({ error: msg }, 500);
  }
});

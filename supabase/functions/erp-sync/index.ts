// API REST de synchronisation ERP — module indépendant.
// Routage interne : /erp-sync/api/... (le préfixe /functions/v1/erp-sync est retiré).
// Auth : soit une clé de service (header X-API-Key, intégration serveur/ERP hors Lovable),
//        soit un JWT applicatif (Authorization: Bearer <token>) + contrôle de rôle.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { openApiSpec } from "./openapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-erp-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEFAULT_ROLES = [
  "admin",
  "responsable_si",
  "bureau_methode",
  "gestionnaire_magasin",
  "responsable_magasin",
] as const;

// Configuration pilotée depuis Paramètres > API ERP (table app_settings).
type ErpConfig = { enabled: boolean; roles: string[]; apiKeys: string[]; serviceUserId: string | null };

async function loadConfig(admin: SupabaseClient): Promise<ErpConfig> {
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "erp_sync.enabled",
      "erp_sync.allowed_roles",
      "erp_sync.api_key",
      "erp_sync.service_user_id",
    ]);
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as { key: string; value: string | null }[]) map[r.key] = r.value ?? "";
  const roles = (map["erp_sync.allowed_roles"] ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  // Plusieurs clés possibles (rotation sans coupure) : séparateur virgule.
  const apiKeys = [map["erp_sync.api_key"] ?? "", Deno.env.get("ERP_SYNC_API_KEY") ?? ""]
    .join(",")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 16);
  return {
    // Activée par défaut (aucune ligne en base = comportement historique).
    enabled: map["erp_sync.enabled"] !== "false",
    roles: roles.length ? roles : [...DEFAULT_ROLES],
    apiKeys,
    serviceUserId: (map["erp_sync.service_user_id"] || "").trim() || null,
  };
}


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(status: number, error: string, details?: unknown) {
  return json({ error, details: details ?? null, status }, status);
}

type Actor = { id: string; email: string | null; roles: string[]; via?: "jwt" | "api_key" };

// Comparaison à temps constant (évite les attaques temporelles sur la clé).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function presentedApiKey(req: Request): string | null {
  const direct = req.headers.get("x-api-key") || req.headers.get("x-erp-api-key");
  if (direct?.trim()) return direct.trim();
  const auth = req.headers.get("Authorization") ?? "";
  const m = auth.match(/^(?:ApiKey|Token)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Compte technique utilisé pour les écritures faites via clé de service.
let cachedServiceUser: { id: string; email: string | null } | null = null;
async function resolveServiceUser(admin: SupabaseClient, cfg: ErpConfig) {
  if (cachedServiceUser) return cachedServiceUser;
  let id = cfg.serviceUserId;
  if (!id) {
    const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    id = (data ?? [])[0]?.user_id ?? null;
  }
  if (!id) return null;
  const { data: prof } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", id)
    .maybeSingle();
  const p = prof as { first_name?: string; last_name?: string } | null;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
  cachedServiceUser = { id, email: name ? `${name} (API ERP)` : "erp-api@service" };

  return cachedServiceUser;
}

async function authenticate(req: Request, admin: SupabaseClient, cfg: ErpConfig): Promise<Actor | Response> {
  // 1) Intégration serveur à serveur : clé de service (aucune session utilisateur requise).
  const key = presentedApiKey(req);
  if (key) {
    if (!cfg.apiKeys.length) {
      return fail(401, "Aucune clé de service configurée (Paramètres > API ERP)");
    }
    if (!cfg.apiKeys.some((k) => safeEqual(k, key))) return fail(401, "Clé de service invalide");
    const svc = await resolveServiceUser(admin, cfg);
    if (!svc) {
      return fail(
        500,
        "Compte technique introuvable : renseignez l'utilisateur technique dans Paramètres > API ERP",
      );
    }
    return { id: svc.id, email: svc.email, roles: ["service"], via: "api_key" };
  }

  // 2) Intégration interactive : JWT applicatif + contrôle de rôle.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return fail(401, "Authentification requise : header X-API-Key (serveur) ou Authorization: Bearer <jwt>");
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return fail(401, "JWT invalide ou expiré");

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);

  if (!roles.some((r) => cfg.roles.includes(r))) {
    return fail(403, "Rôle insuffisant pour la synchronisation ERP", { roles_requis: cfg.roles });
  }
  return { id: userData.user.id, email: userData.user.email ?? null, roles, via: "jwt" };
}



function pagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100") || 100));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}

function paged(data: unknown[], count: number | null, page: number, limit: number) {
  const total = count ?? data.length;
  return {
    data,
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// Code ERP prioritaire, mais on ignore les chaînes vides.
function code(erp: unknown, fallback: unknown): string | null {
  const e = typeof erp === "string" ? erp.trim() : erp == null ? "" : String(erp);
  if (e) return e;
  const f = typeof fallback === "string" ? fallback.trim() : fallback == null ? "" : String(fallback);
  return f || null;
}

type Ref = { id: string; code: string | null; code_erp: string | null; designation: string | null; nom?: string | null };

async function lookupProducts(admin: SupabaseClient, ids: (string | null)[]) {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  const map: Record<string, Ref> = {};
  if (!uniq.length) return map;
  const { data } = await admin.from("products").select("id, code, code_erp, designation").in("id", uniq);
  for (const r of (data ?? []) as Ref[]) map[r.id] = r;
  return map;
}

async function lookupLines(admin: SupabaseClient, ids: (string | null)[]) {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  const map: Record<string, Ref> = {};
  if (!uniq.length) return map;
  const { data } = await admin.from("production_lines").select("id, code, nom").in("id", uniq);
  for (const r of (data ?? []) as unknown as Ref[]) map[r.id] = r;
  return map;
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: string; details?: string; hint?: string };
    return o.message || o.details || o.hint || JSON.stringify(e);
  }
  return String(e);
}



async function logCall(
  admin: SupabaseClient,
  entry: {
    direction: string;
    resource: string;
    method: string;
    status_code: number;
    ok: boolean;
    record_count?: number;
    error?: string | null;
    request_summary?: Record<string, unknown>;
    response_summary?: Record<string, unknown>;
    duration_ms?: number;
    actor?: Actor | null;
  },
) {
  try {
    await admin.from("erp_sync_logs").insert({
      direction: entry.direction,
      resource: entry.resource,
      method: entry.method,
      status_code: entry.status_code,
      ok: entry.ok,
      record_count: entry.record_count ?? 0,
      error: entry.error ?? null,
      request_summary: entry.request_summary ?? {},
      response_summary: entry.response_summary ?? {},
      duration_ms: entry.duration_ms ?? null,
      actor_id: entry.actor?.id ?? null,
      actor_email: entry.actor?.email ?? null,
    });
    await admin.from("erp_sync_state").upsert(
      {
        resource: entry.resource,
        last_record_count: entry.record_count ?? 0,
        ...(entry.ok
          ? { last_success_at: new Date().toISOString() }
          : { last_error_at: new Date().toISOString(), last_error: entry.error ?? "erreur" }),
      },
      { onConflict: "resource" },
    );
    // Rétention 30 jours
    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      await admin.from("erp_sync_logs").delete().lt("created_at", cutoff);
    }
  } catch (_e) {
    // ne jamais faire échouer l'appel métier à cause du journal
  }
}

/* ------------------------------- EXPORTS ------------------------------- */

async function exportResource(resource: string, url: URL, admin: SupabaseClient) {
  const { page, limit, from, to } = pagination(url);
  const since = url.searchParams.get("updated_since");
  const opts = { count: "exact" as const };

  if (resource === "articles") {
    let q = admin
      .from("pdr")
      .select(
        "id, reference, code_erp, designation, unite_stock, statut_pdr, criticite, is_active, family_id, emplacement, stock_actuel, stock_min, stock_max, pmp, prix_unitaire, updated_at",
        opts,
      )
      .order("reference")
      .range(from, to);
    if (since) q = q.gte("updated_at", since);
    const { data, count, error } = await q;
    if (error) throw error;
    return paged(
      (data ?? []).map((r: Record<string, unknown>) => ({
        code_article: code(r.code_erp, r.reference),
        reference: r.reference,
        designation: r.designation,
        unite: r.unite_stock ?? "U",
        famille_id: r.family_id,
        statut: r.is_active === false ? "inactif" : "actif",
        statut_pdr: r.statut_pdr,
        criticite: r.criticite,
        emplacement: r.emplacement,
        stock_actuel: Number(r.stock_actuel ?? 0),
        stock_min: Number(r.stock_min ?? 0),
        stock_max: Number(r.stock_max ?? 0),
        prix_unitaire: Number(r.pmp ?? r.prix_unitaire ?? 0),
        id_interne: r.id,
        updated_at: r.updated_at,
      })),
      count,
      page,
      limit,
    );
  }

  if (resource === "articles/production") {
    let q = admin
      .from("products")
      .select("id, code, code_erp, designation, unite, unite_base, poids_unitaire, family_id, is_active, updated_at", opts)
      .order("code")
      .range(from, to);
    if (since) q = q.gte("updated_at", since);
    const { data, count, error } = await q;
    if (error) throw error;

    const ids = (data ?? []).map((p: { id: string }) => p.id);
    const cycles: Record<string, unknown> = {};
    if (ids.length) {
      const { data: recipes } = await admin
        .from("recipes")
        .select("product_id, name, version, is_active")
        .in("product_id", ids)
        .eq("is_active", true);
      for (const r of recipes ?? []) cycles[(r as { product_id: string }).product_id] = r;
    }
    return paged(
      (data ?? []).map((p: Record<string, unknown>) => {
        const g = cycles[p.id as string] as { name?: string; version?: number } | undefined;
        return {
          code_article: code(p.code_erp, p.code),
          code: p.code,
          designation: p.designation,
          unite: p.unite ?? p.unite_base ?? "U",
          poids_unitaire: Number(p.poids_unitaire ?? 0),
          famille_id: p.family_id,
          gamme: g?.name ?? null,
          gamme_version: g?.version ?? null,
          statut: p.is_active === false ? "inactif" : "actif",
          id_interne: p.id,
          updated_at: p.updated_at,
        };
      }),
      count,
      page,
      limit,
    );
  }

  if (resource === "nomenclatures") {
    const productCode = url.searchParams.get("product_code");
    let bq = admin
      .from("bill_of_materials")
      .select("id, product_id, version, status, valid_from, valid_to, updated_at, products!inner(code, code_erp, designation)", opts)
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (since) bq = bq.gte("updated_at", since);
    if (productCode) bq = bq.eq("products.code", productCode);
    const { data: boms, count, error } = await bq;
    if (error) throw error;

    const bomIds = (boms ?? []).map((b: { id: string }) => b.id);
    let items: Record<string, unknown>[] = [];
    if (bomIds.length) {
      const { data: itemRows, error: itemErr } = await admin
        .from("bom_items")
        .select("bom_id, quantity_per_unit, unit, waste_percent, is_mandatory, item_type, articles!inner(code, code_erp, designation, unite)")
        .in("bom_id", bomIds);
      if (itemErr) throw itemErr;
      items = (itemRows ?? []) as Record<string, unknown>[];
    }
    return paged(
      (boms ?? []).map((b: Record<string, unknown>) => {
        const p = b.products as { code: string; code_erp: string | null; designation: string };
        return {
          nomenclature_id: b.id,
          article_parent: code(p.code_erp, p.code),
          designation_parent: p.designation,
          version: b.version,
          statut: b.status,
          valide_du: b.valid_from,
          valide_au: b.valid_to,
          composants: items
            .filter((i) => i.bom_id === b.id)
            .map((i) => {
              const a = i.articles as { code: string; code_erp: string | null; designation: string; unite: string | null };
              return {
                code_article: code(a.code_erp, a.code),
                designation: a.designation,
                quantite_par_unite: Number(i.quantity_per_unit ?? 0),
                unite: i.unit ?? a.unite ?? "U",
                perte_pourcent: Number(i.waste_percent ?? 0),
                obligatoire: i.is_mandatory !== false,
                type: i.item_type,
              };
            }),
        };
      }),
      count,
      page,
      limit,
    );
  }

  if (resource === "stock") {
    const type = (url.searchParams.get("type") ?? "all").toLowerCase();
    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    let total = 0;
    if (type === "pdr" || type === "all") {
      const { data, count, error } = await admin
        .from("pdr")
        .select("reference, code_erp, designation, stock_actuel, stock_reserve, unite_stock, emplacement, updated_at", opts)
        .order("reference")
        .range(from, to);
      if (error) throw error;
      total += count ?? 0;
      for (const r of data ?? []) {
        const p = r as Record<string, unknown>;
        rows.push({
          type: "pdr",
          code_article: code(p.code_erp, p.reference),
          designation: p.designation,
          quantite: Number(p.stock_actuel ?? 0),
          quantite_reservee: Number(p.stock_reserve ?? 0),
          unite: p.unite_stock ?? "U",
          emplacement: p.emplacement,
          date: p.updated_at ?? now,
        });
      }
    }
    if (type === "article" || type === "all") {
      const { data, count, error } = await admin
        .from("articles")
        .select("code, code_erp, designation, stock_actuel, stock_min, unite, updated_at", opts)
        .order("code")
        .range(from, to);
      if (error) throw error;
      total += count ?? 0;
      for (const r of data ?? []) {
        const a = r as Record<string, unknown>;
        rows.push({
          type: "article",
          code_article: code(a.code_erp, a.code),
          designation: a.designation,
          quantite: Number(a.stock_actuel ?? 0),
          quantite_min: Number(a.stock_min ?? 0),
          unite: a.unite ?? "U",
          emplacement: null,
          date: a.updated_at ?? now,
        });
      }
    }
    return paged(rows, total, page, limit);
  }

  if (resource === "orders") {
    let q = admin
      .from("ordres_fabrication")
      .select(
        "id, numero, statut, quantite_prevue, quantite_produite, quantite_rebut, unite, date_debut_prevue, date_fin_prevue, date_debut_reelle, date_fin_reelle, quality_status, updated_at, product_id, line_id",
        opts,
      )
      .order("date_debut_prevue", { ascending: false })
      .range(from, to);
    const statut = url.searchParams.get("statut");
    if (statut) q = q.eq("statut", statut);
    const dateFrom = url.searchParams.get("date_from");
    if (dateFrom) q = q.gte("date_debut_prevue", dateFrom);
    const dateTo = url.searchParams.get("date_to");
    if (dateTo) q = q.lte("date_debut_prevue", dateTo);
    if (since) q = q.gte("updated_at", since);
    const { data, count, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const productMap = await lookupProducts(admin, rows.map((r) => r.product_id as string | null));
    const lineMap = await lookupLines(admin, rows.map((r) => r.line_id as string | null));

    return paged(
      rows.map((o) => {
        const p = productMap[String(o.product_id)];
        const l = lineMap[String(o.line_id)];
        return {
          numero_of: o.numero,
          code_article: p ? code(p.code_erp, p.code) : null,
          designation_article: p?.designation ?? null,
          ligne: l ? l.code ?? l.nom : null,
          quantite_prevue: Number(o.quantite_prevue ?? 0),
          quantite_produite: Number(o.quantite_produite ?? 0),
          quantite_rebut: Number(o.quantite_rebut ?? 0),
          unite: o.unite,
          statut: o.statut,
          statut_qualite: o.quality_status,
          date_debut_prevue: o.date_debut_prevue,
          date_fin_prevue: o.date_fin_prevue,
          date_debut_reelle: o.date_debut_reelle,
          date_fin_reelle: o.date_fin_reelle,
          id_interne: o.id,
        };
      }),
      count,
      page,
      limit,
    );
  }

  if (resource === "campagnes") {
    let q = admin
      .from("reception_campaigns")
      .select("id, code, libelle, date_debut, date_fin, objectif_kg, actif, is_default, updated_at, product_id", opts)
      .order("date_debut", { ascending: false })
      .range(from, to);
    if (since) q = q.gte("updated_at", since);
    const { data, count, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const productMap = await lookupProducts(admin, rows.map((r) => r.product_id as string | null));

    return paged(
      rows.map((c) => {
        const p = productMap[String(c.product_id)];
        return {
          code_campagne: c.code,
          libelle: c.libelle,
          code_article: p ? code(p.code_erp, p.code) : null,
          produit: p?.designation ?? null,
          date_debut: c.date_debut,
          date_fin: c.date_fin,
          objectif_kg: Number(c.objectif_kg ?? 0),
          active: c.actif !== false,
          par_defaut: c.is_default === true,
          id_interne: c.id,
        };
      }),
      count,
      page,
      limit,

    );
  }

  return null;
}

/* ------------------------------- IMPORTS ------------------------------- */

type LineResult = { index: number; erp_ref: string | null; status: "created" | "updated" | "skipped" | "error"; message?: string; id?: string };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function importPdrConsumptions(items: Record<string, unknown>[], admin: SupabaseClient, actor: Actor) {
  const results: LineResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] ?? {};
    const erpRef = (it.erp_ref as string) ?? null;
    const code = String(it.article_code ?? it.code_article ?? "").trim();
    const qty = num(it.quantite ?? it.quantity);
    try {
      if (!code) throw new Error("article_code manquant");
      if (qty === null || qty < 0) throw new Error("quantite invalide (doit être ≥ 0)");

      const { data: pdrRows, error: pdrErr } = await admin
        .from("pdr")
        .select("id, reference, stock_actuel")
        .or(`reference.eq.${code},code_erp.eq.${code}`)
        .limit(2);
      if (pdrErr) throw pdrErr;
      if (!pdrRows?.length) throw new Error(`Article PDR inconnu : ${code}`);
      if (pdrRows.length > 1) throw new Error(`Code ambigu (plusieurs PDR) : ${code}`);
      const pdrRow = pdrRows[0] as { id: string; stock_actuel: number | null };

      let ofId: string | null = null;
      if (it.of_numero) {
        const { data: of } = await admin
          .from("ordres_fabrication")
          .select("id")
          .eq("numero", String(it.of_numero))
          .maybeSingle();
        if (!of) throw new Error(`OF inconnu : ${it.of_numero}`);
        ofId = (of as { id: string }).id;
      }

      // Idempotence / conflits : même erp_ref => mise à jour
      if (erpRef) {
        const { data: existing } = await admin
          .from("pdr_stock_movements")
          .select("id, quantite")
          .eq("ref_document_erp", erpRef)
          .maybeSingle();
        if (existing) {
          const ex = existing as { id: string; quantite: number };
          if (Number(ex.quantite) === qty) {
            results.push({ index: i, erp_ref: erpRef, status: "skipped", message: "déjà synchronisé (quantité identique)", id: ex.id });
            continue;
          }
          const delta = qty - Number(ex.quantite);
          await admin
            .from("pdr_stock_movements")
            .update({ quantite: qty, motif: (it.motif as string) ?? "Consommation ERP (corrigée)", erp_synced_at: new Date().toISOString(), modified_by: actor.id, modified_at: new Date().toISOString() })
            .eq("id", ex.id);
          await admin
            .from("pdr")
            .update({ stock_actuel: Number(pdrRow.stock_actuel ?? 0) - delta })
            .eq("id", pdrRow.id);
          results.push({ index: i, erp_ref: erpRef, status: "updated", id: ex.id });
          continue;
        }
      }

      const avant = Number(pdrRow.stock_actuel ?? 0);
      const apres = avant - qty;
      const { data: inserted, error: insErr } = await admin
        .from("pdr_stock_movements")
        .insert({
          pdr_id: pdrRow.id,
          type: "sortie",
          quantite: qty,
          stock_avant: avant,
          stock_apres: apres,
          source_type: "erp",
          source_id: ofId,
          reference_source: (it.lot as string) ?? (it.of_numero as string) ?? null,
          motif: (it.motif as string) ?? "Consommation ERP",
          ref_document_erp: erpRef,
          erp_synced_at: new Date().toISOString(),
          user_id: actor.id,
          applied: true,
          created_at: (it.date as string) ?? new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      await admin.from("pdr").update({ stock_actuel: apres }).eq("id", pdrRow.id);
      results.push({ index: i, erp_ref: erpRef, status: "created", id: (inserted as { id: string }).id });
    } catch (e) {
      results.push({ index: i, erp_ref: erpRef, status: "error", message: errMessage(e) });
    }
  }
  return results;
}

async function importArticleConsumptions(items: Record<string, unknown>[], admin: SupabaseClient, actor: Actor) {
  const results: LineResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] ?? {};
    const erpRef = (it.erp_ref as string) ?? null;
    const code = String(it.article_code ?? it.code_article ?? "").trim();
    const qty = num(it.quantite ?? it.quantity);
    try {
      if (!code) throw new Error("article_code manquant");
      if (qty === null || qty < 0) throw new Error("quantite invalide (doit être ≥ 0)");
      if (!it.of_numero) throw new Error("of_numero requis");

      const { data: artRows, error: artErr } = await admin
        .from("articles")
        .select("id, code, unite")
        .or(`code.eq.${code},code_erp.eq.${code}`)
        .limit(2);
      if (artErr) throw artErr;
      if (!artRows?.length) throw new Error(`Article inconnu : ${code}`);
      if (artRows.length > 1) throw new Error(`Code ambigu (plusieurs articles) : ${code}`);
      const art = artRows[0] as { id: string; unite: string | null };

      const { data: of } = await admin
        .from("ordres_fabrication")
        .select("id")
        .eq("numero", String(it.of_numero))
        .maybeSingle();
      if (!of) throw new Error(`OF inconnu : ${it.of_numero}`);
      const ofId = (of as { id: string }).id;

      const payload = {
        of_id: ofId,
        article_id: art.id,
        quantite: qty,
        unite: (it.unite as string) ?? art.unite ?? "U",
        lot_number: (it.lot as string) ?? null,
        notes: "Import ERP",
        declared_by: actor.id,
        erp_ref: erpRef,
        erp_synced_at: new Date().toISOString(),
        created_at: (it.date as string) ?? new Date().toISOString(),
      };

      if (erpRef) {
        const { data: existing } = await admin.from("consumptions").select("id, quantite").eq("erp_ref", erpRef).maybeSingle();
        if (existing) {
          const ex = existing as { id: string; quantite: number };
          if (Number(ex.quantite) === qty) {
            results.push({ index: i, erp_ref: erpRef, status: "skipped", message: "déjà synchronisé (quantité identique)", id: ex.id });
            continue;
          }
          await admin.from("consumptions").update({ quantite: qty, erp_synced_at: payload.erp_synced_at }).eq("id", ex.id);
          results.push({ index: i, erp_ref: erpRef, status: "updated", id: ex.id });
          continue;
        }
      } else {
        // Conflit sans clé ERP : même OF + même article + même jour => mise à jour
        const day = new Date(payload.created_at as string);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
        const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();
        const { data: dup } = await admin
          .from("consumptions")
          .select("id")
          .eq("of_id", ofId)
          .eq("article_id", art.id)
          .gte("created_at", start)
          .lt("created_at", end)
          .limit(1)
          .maybeSingle();
        if (dup) {
          await admin.from("consumptions").update({ quantite: qty, erp_synced_at: payload.erp_synced_at }).eq("id", (dup as { id: string }).id);
          results.push({ index: i, erp_ref: null, status: "updated", id: (dup as { id: string }).id });
          continue;
        }
      }

      const { data: inserted, error: insErr } = await admin.from("consumptions").insert(payload).select("id").single();
      if (insErr) throw insErr;
      results.push({ index: i, erp_ref: erpRef, status: "created", id: (inserted as { id: string }).id });
    } catch (e) {
      results.push({ index: i, erp_ref: erpRef, status: "error", message: errMessage(e) });
    }
  }
  return results;
}

function summarize(results: LineResult[]) {
  return {
    total: results.length,
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };
}

/* -------------------------------- ROUTER ------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  const url = new URL(req.url);
  // Retire /functions/v1/erp-sync et normalise en "sync/articles", "ping", ...
  let path = url.pathname
    .replace(/^\/functions\/v1/, "")
    .replace(/^\/erp-sync/, "")
    .replace(/^\/api/, "")
    .replace(/^\/+|\/+$/g, "");
  if (!path) path = "ping";

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const cfg = await loadConfig(admin);

  // Endpoints publics
  if (path === "ping") {
    return json({
      status: cfg.enabled ? "ok" : "disabled",
      service: "erp-sync",
      version: "1.1.0",
      api_activee: cfg.enabled,
      auth: {
        api_key: cfg.apiKeys.length > 0 ? "X-API-Key" : "non configurée",
        jwt: "Authorization: Bearer <access_token>",
      },
      time: new Date().toISOString(),
    });
  }
  if (path === "docs") {
    return json(openApiSpec(`${url.origin}/functions/v1/erp-sync`));
  }


  // Interrupteur global (Paramètres > API ERP). Ne bloque jamais ping/docs.
  if (!cfg.enabled) {
    await logCall(admin, {
      direction: "system",
      resource: path,
      method: req.method,
      status_code: 503,
      ok: false,
      error: "API ERP désactivée dans la configuration",
      duration_ms: Date.now() - started,
    });
    return fail(503, "API de synchronisation ERP désactivée par l'administrateur");
  }

  const actorOrRes = await authenticate(req, admin, cfg);

  if (actorOrRes instanceof Response) {
    await logCall(admin, {
      direction: "system",
      resource: path,
      method: req.method,
      status_code: actorOrRes.status,
      ok: false,
      error: actorOrRes.status === 401 ? "Non authentifié" : "Rôle insuffisant",
      duration_ms: Date.now() - started,
    });
    return actorOrRes;
  }
  const actor = actorOrRes;

  try {
    // Contrôle d'intégration : permet au serveur ERP de valider sa clé.
    if (req.method === "GET" && (path === "sync/whoami" || path === "whoami")) {
      return json({
        authentifie: true,
        mode: actor.via ?? "jwt",
        acteur: actor.email,
        roles: actor.roles,
        api_activee: cfg.enabled,
      });
    }

    // Supervision

    if (req.method === "GET" && path === "sync/status") {
      const { data: state } = await admin.from("erp_sync_state").select("*").order("resource");
      const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: calls24h } = await admin.from("erp_sync_logs").select("id", { count: "exact", head: true }).gte("created_at", cutoff);
      const { count: errors24h } = await admin
        .from("erp_sync_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", cutoff)
        .eq("ok", false);
      return json({
        status: (errors24h ?? 0) === 0 ? "healthy" : "degraded",
        appels_24h: calls24h ?? 0,
        erreurs_24h: errors24h ?? 0,
        ressources: state ?? [],
      });
    }

    if (req.method === "GET" && path === "sync/last") {
      const { data } = await admin.from("erp_sync_state").select("resource, last_success_at, last_error_at, last_record_count").order("resource");
      const last = (data ?? []).reduce<string | null>((acc, r) => {
        const v = (r as { last_success_at: string | null }).last_success_at;
        return v && (!acc || v > acc) ? v : acc;
      }, null);
      return json({ derniere_synchronisation: last, par_ressource: data ?? [] });
    }

    if (req.method === "GET" && path === "sync/history") {
      const { page, limit, from, to } = pagination(url);
      let q = admin.from("erp_sync_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      const res = url.searchParams.get("resource");
      if (res) q = q.eq("resource", res);
      const okParam = url.searchParams.get("ok");
      if (okParam === "true" || okParam === "false") q = q.eq("ok", okParam === "true");
      const { data, count, error } = await q;
      if (error) throw error;
      return json(paged(data ?? [], count, page, limit));
    }

    // Exports
    if (req.method === "GET" && path.startsWith("sync/")) {
      const resource = path.slice("sync/".length);
      const result = await exportResource(resource, url, admin);
      if (!result) return fail(404, `Endpoint inconnu : /api/${path}`);
      await logCall(admin, {
        direction: "export",
        resource,
        method: "GET",
        status_code: 200,
        ok: true,
        record_count: result.data.length,
        request_summary: Object.fromEntries(url.searchParams),
        response_summary: { pagination: result.pagination },
        duration_ms: Date.now() - started,
        actor,
      });
      return json(result);
    }

    // Imports
    if (req.method === "POST" && path.startsWith("sync/consumption")) {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return fail(400, "Corps JSON invalide");
      }
      const kind = path.slice("sync/consumption".length).replace(/^\//, "");

      const asArray = (v: unknown): Record<string, unknown>[] =>
        Array.isArray(v) ? (v as Record<string, unknown>[]) : v ? [v as Record<string, unknown>] : [];

      let pdrItems: Record<string, unknown>[] = [];
      let artItems: Record<string, unknown>[] = [];
      if (kind === "pdr") pdrItems = asArray(body.items ?? body);
      else if (kind === "articles") artItems = asArray(body.items ?? body);
      else if (kind === "batch") {
        pdrItems = asArray(body.pdr);
        artItems = asArray(body.articles);
      } else return fail(404, `Endpoint inconnu : /api/${path}`);

      if (!pdrItems.length && !artItems.length) return fail(400, "Aucune consommation fournie");
      if (pdrItems.length + artItems.length > 1000) return fail(400, "Maximum 1000 lignes par requête");

      const pdrResults = pdrItems.length ? await importPdrConsumptions(pdrItems, admin, actor) : [];
      const artResults = artItems.length ? await importArticleConsumptions(artItems, admin, actor) : [];
      const all = [...pdrResults, ...artResults];
      const summary = summarize(all);
      const status = summary.errors === 0 ? 200 : summary.errors === all.length ? 400 : 207;

      await logCall(admin, {
        direction: "import",
        resource: `consumption/${kind}`,
        method: "POST",
        status_code: status,
        ok: summary.errors === 0,
        record_count: summary.created + summary.updated,
        error: summary.errors ? `${summary.errors} ligne(s) en erreur` : null,
        request_summary: { lignes: all.length },
        response_summary: summary,
        duration_ms: Date.now() - started,
        actor,
      });

      return json(
        {
          success: summary.errors === 0,
          resume: summary,
          resultats: kind === "batch" ? { pdr: pdrResults, articles: artResults } : all,
        },
        status,
      );
    }

    return fail(404, `Endpoint inconnu : ${req.method} /api/${path}`);
  } catch (e) {
    const message = errMessage(e);
    console.error("erp-sync error", path, message);
    await logCall(admin, {
      direction: req.method === "POST" ? "import" : "export",
      resource: path,
      method: req.method,
      status_code: 500,
      ok: false,
      error: message,
      duration_ms: Date.now() - started,
      actor,
    });
    return fail(500, "Erreur interne de synchronisation", message);
  }
});

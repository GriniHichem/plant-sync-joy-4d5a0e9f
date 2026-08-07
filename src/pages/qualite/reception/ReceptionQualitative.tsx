import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Clock, Lock, Truck, XCircle, Search, Lightbulb, TrendingDown, Weight } from "lucide-react";
import { toast } from "sonner";
import { PhotoSlot } from "./PhotoSlot";
import { SupplierCombobox } from "@/components/reception/SupplierCombobox";

import { TicketDetailDialog } from "./TicketDetailDialog";
import { format, startOfToday, setHours, setMinutes, setSeconds, addDays, isWithinInterval, isBefore, subDays } from "date-fns";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";
import { StickyActionBar } from "@/components/responsive/StickyActionBar";
import { receptionDraftStore, DRAFT_KEY, DRAFT_MAX_AGE_MS } from "./receptionDraftStore";
import { OrientationsAdvisorDialog } from "@/components/reception/OrientationsAdvisorDialog";
import { useAuth } from "@/contexts/AuthContext";

export default function ReceptionQualitative() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { canCreate, canEdit } = usePermissions();
  const canCreateTicket = canCreate("reception_qualitative");
  const canCloseTicket = canCreate("reception_qualitative") || canEdit("reception_qualitative");


  const [ticketId, setTicketId] = useState<string | undefined>();
  
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [form, setForm] = useState({
    numero: "",
    campaign_id: "",
    supplier_id: "",
    heure_debut: "",
    heure_fin: "",
    taux_abattement: "",
    commentaire: "",
  });

  // Données statiques : mises en cache 10 min pour éviter les appels répétés
  const STATIC_CACHE = { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false } as const;

  // Campagne par défaut
  const { data: defaultCampaign } = useQuery({
    queryKey: ["reception_campaigns", "default"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reception_campaigns" as any)
        .select("*, reception_products(designation, code)")
        .eq("is_default", true).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    ...STATIC_CACHE,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["reception_campaigns", "active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reception_campaigns" as any)
        .select("id, libelle, product_id, is_default, actif, date_debut, objectif_kg, reception_products(designation, code)")
        .eq("actif", true).order("date_debut", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    ...STATIC_CACHE,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["reception_suppliers", "agree"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reception_suppliers" as any)
        .select("id, nom, code").eq("agree", true).eq("actif", true).order("nom");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    ...STATIC_CACHE,
  });



  useEffect(() => {
    if (!form.campaign_id && defaultCampaign?.id) {
      setForm((f) => ({ ...f, campaign_id: defaultCampaign.id }));
    }
  }, [defaultCampaign?.id]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c: any) => c.id === form.campaign_id) ?? defaultCampaign,
    [campaigns, form.campaign_id, defaultCampaign],
  );

  // Photos du ticket
  const { data: photos = [] } = useQuery({
    queryKey: ["reception_photos", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reception_ticket_photos" as any)
        .select("*").eq("ticket_id", ticketId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!form.numero.trim()) throw new Error("Numéro de ticket requis");
      if (!form.campaign_id || !form.supplier_id) throw new Error("Campagne et fournisseur requis");
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("reception_tickets" as any).insert({
        numero: form.numero.trim(),
        campaign_id: form.campaign_id,
        product_id: selectedCampaign?.product_id,
        supplier_id: form.supplier_id,
        heure_debut: form.heure_debut || null,
        taux_abattement: form.taux_abattement ? Number(form.taux_abattement) : 0,
        commentaire: form.commentaire || null,
        created_by: auth.user?.id ?? null,
      }).select("*").single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (t: any) => {
      setTicketId(t.id);
      setSavedNumero(t.numero);
      toast.success(`Ticket ${t.numero} ouvert — ajoutez les 3 photos`);
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Ce numéro de ticket existe déjà" : e.message),
  });

  // Correction du numéro de ticket avant clôture (unicité vérifiée côté base)
  const [savedNumero, setSavedNumero] = useState<string | null>(null);
  const renameTicket = useMutation({
    mutationFn: async () => {
      const next = form.numero.trim();
      if (!next) throw new Error("Numéro de ticket requis");
      if (!ticketId) throw new Error("Aucun ticket en cours");
      const { data: dup } = await supabase.from("reception_tickets" as any)
        .select("id").eq("numero", next).neq("id", ticketId).maybeSingle();
      if (dup) throw new Error("Ce numéro de ticket existe déjà. Veuillez en saisir un autre.");
      const { error } = await supabase.rpc("reception_rename_ticket" as any, {
        p_ticket_id: ticketId, p_new_numero: next,
      });
      if (error) throw error;
      return next;
    },
    onSuccess: (n) => {
      setSavedNumero(n);
      qc.invalidateQueries({ queryKey: ["reception_tickets_recent"] });
      qc.invalidateQueries({ queryKey: ["reception_tickets_last_numero"] });
      toast.success(`Numéro corrigé — ticket N°${n}`);
    },
    onError: (e: any) =>
      toast.error(e.message?.includes("déjà utilisé")
        ? "Ce numéro de ticket existe déjà. Veuillez en saisir un autre."
        : e.message ?? "Modification impossible"),
  });


  const updateTicket = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("reception_tickets" as any).update(payload).eq("id", ticketId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception_tickets_recent"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addPhoto = useMutation({
    mutationFn: async ({ slot, path }: { slot: number; path: string }) => {
      const { error } = await supabase.from("reception_ticket_photos" as any).insert({
        ticket_id: ticketId!, slot, storage_path: path,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception_photos", ticketId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removePhoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reception_ticket_photos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception_photos", ticketId] }),
  });

  const closeTicket = useMutation({
    mutationFn: async () => {
      if (form.taux_abattement === "" || form.taux_abattement === null || form.taux_abattement === undefined) {
        throw new Error("Le taux d'abattement est obligatoire. Si aucun abattement n'est appliqué, veuillez saisir 0.");
      }
      const abat = Number(form.taux_abattement);
      if (Number.isNaN(abat) || abat < 0 || abat > 100) {
        throw new Error("Taux d'abattement invalide (0 à 100).");
      }
      // Persist la valeur d'abattement + heure_fin en direct avant clôture
      await supabase.from("reception_tickets" as any).update({
        heure_debut: form.heure_debut || null,
        heure_fin: form.heure_fin || null,
        taux_abattement: abat,
        commentaire: form.commentaire || null,
        supplier_id: form.supplier_id,
      }).eq("id", ticketId!);
      const { data, error } = await supabase.rpc("close_reception_ticket" as any, { _ticket_id: ticketId! });
      if (error) throw error;
      return { data, numero: form.numero };
    },
    onSuccess: (res: any) => {
      toast.success(`Ticket N°${res?.numero ?? ""} clôturé avec succès`);
      setTicketId(undefined);
      setSavedNumero(null);
      setForm({ numero: "", campaign_id: defaultCampaign?.id ?? "", supplier_id: "", heure_debut: "", heure_fin: "", taux_abattement: "", commentaire: "" });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["reception_tickets_recent"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [cancelMotif, setCancelMotif] = useState("");
  const cancelTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_reception_ticket" as any, { _ticket_id: ticketId!, _motif: cancelMotif });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket annulé — page réinitialisée");
      setTicketId(undefined);
      setSavedNumero(null);
      setCancelMotif("");
      setForm({ numero: "", campaign_id: defaultCampaign?.id ?? "", supplier_id: "", heure_debut: "", heure_fin: "", taux_abattement: "", commentaire: "" });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["reception_photos", ticketId] });
    },
    onError: (e: any) => toast.error(e.message),
  });



  const { data: recent = [] } = useQuery({
    queryKey: ["reception_tickets_recent", user?.id],
    queryFn: async () => {
      console.log("Fetching recent tickets for user:", user?.id);
      const { data, error } = await supabase.from("v_reception_global")
        .select("*")
        .or(`created_by.eq.${user?.id},cloture_by.eq.${user?.id}`)
        .in("statut", ["cloture", "pese_importe"])
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Error fetching recent tickets:", error);
        throw error;
      }
      console.log("Recent tickets found:", data?.length);
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  const [period, setPeriod] = useState<"matin" | "apres_midi" | "nuit">(() => {
    const now = new Date();
    const h = now.getHours();
    if (h >= 6 && h < 14) return "matin";
    if (h >= 14 && h < 22) return "apres_midi";
    return "nuit";
  });

  const periodRange = useMemo(() => {
    const now = new Date();
    let start = startOfToday();
    
    // Si on est avant 6h, la "journée de réception" a commencé hier à 6h
    if (now.getHours() < 6) {
      start = subDays(start, 1);
    }
    
    start = setHours(start, 6);
    start = setMinutes(start, 0);
    start = setSeconds(start, 0);

    let pStart, pEnd;
    if (period === "matin") {
      pStart = start;
      pEnd = setHours(start, 14);
    } else if (period === "apres_midi") {
      pStart = setHours(start, 14);
      pEnd = setHours(start, 22);
    } else {
      pStart = setHours(start, 22);
      pEnd = addDays(start, 1);
      pEnd = setHours(pEnd, 6);
    }
    return { start: pStart, end: pEnd };
  }, [period]);

  const { data: kpis } = useQuery({
    queryKey: ["reception_user_kpis", user?.id, periodRange.start.toISOString().split('.')[0], periodRange.end.toISOString().split('.')[0], period],
    queryFn: async () => {
      const startTime = periodRange.start.toISOString().split('.')[0].replace('T', ' ');
      const endTime = periodRange.end.toISOString().split('.')[0].replace('T', ' ');
      
      console.log("Fetching KPIs for user:", user?.id, "Period:", startTime, "to", endTime);
      
      const { data, error } = await supabase.rpc("get_reception_user_kpis" as any, {
        p_user_id: user?.id,
        p_start_time: startTime,
        p_end_time: endTime,
      });
      if (error) {
        console.error("Error fetching user KPIs:", error);
        throw error;
      }
      console.log("KPIs data received:", data);
      return data?.[0] as {
        total_brut: number;
        total_net: number;
        total_abattement_kg: number;
        avg_abattement_pct: number;
        ticket_count: number;
        avg_duree?: number;
        a_peser_count?: number;
      };
    },
    enabled: !!user?.id,
  });

  // Dernier numéro de ticket en base (tous statuts) pour contrôle de continuité
  const { data: lastNumero } = useQuery({
    queryKey: ["reception_tickets_last_numero"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reception_tickets" as any)
        .select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data as any)?.numero as string | undefined;
    },
    staleTime: 30_000,
  });

  const [gapDismissed, setGapDismissed] = useState(false);
  useEffect(() => { setGapDismissed(false); }, [form.numero]);

  const numeroGap = useMemo(() => {
    if (ticketId || !lastNumero) return null;
    const n = parseInt(String(lastNumero).replace(/\D/g, ""), 10);
    const next = parseInt(form.numero.replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || !Number.isFinite(next)) return null;
    const gap = next - n;
    return gap >= 3 ? { gap, last: String(lastNumero) } : null;
  }, [lastNumero, form.numero, ticketId]);

  // ---- Validation temps réel du numéro (asynchrone, non bloquante) ----
  const [numeroProbe, setNumeroProbe] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setNumeroProbe(form.numero.trim()), 400);
    return () => clearTimeout(t);
  }, [form.numero]);

  const { data: numeroTaken, isFetching: numeroChecking } = useQuery({
    queryKey: ["reception_numero_taken", numeroProbe, ticketId ?? null],
    enabled: !!numeroProbe,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from("reception_tickets" as any).select("id").eq("numero", numeroProbe).limit(1);
      if (ticketId) q = q.neq("id", ticketId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const heureFormatInvalide = useMemo(
    () =>
      [form.heure_debut, form.heure_fin].some((h) => !!h && !/^\d{2}:\d{2}(:\d{2})?$/.test(h)),
    [form.heure_debut, form.heure_fin],
  );

  const [detailRow, setDetailRow] = useState<any | null>(null);



  // ---------- Brouillon local (persistance 24h) ----------
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { ts: number; ticketId?: string; form: typeof form };
      if (!draft?.ts || Date.now() - draft.ts > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (draft.form) setForm((f) => ({ ...f, ...draft.form }));
      if (draft.ticketId) {
        // Vérifier que le ticket existe encore et n'est pas clôturé
        supabase.from("reception_tickets" as any)
          .select("id, statut").eq("id", draft.ticketId).maybeSingle()
          .then(({ data }: any) => {
            if (data && data.statut !== "cloture") {
              setTicketId(draft.ticketId);
              toast.info("Ticket en cours restauré");
            } else {
              localStorage.removeItem(DRAFT_KEY);
            }
          });
      }
    } catch { /* ignore */ }
  }, []);

  // Sauvegarde debounced
  useEffect(() => {
    if (!restoredRef.current) return;
    const hasContent = !!ticketId || !!form.numero || !!form.supplier_id || !!form.commentaire;
    if (!hasContent) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ts: Date.now(), ticketId, form }));
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [ticketId, form]);

  // Signale au parent (ReceptionPage) qu'un ticket est en cours
  useEffect(() => {
    receptionDraftStore.set(!!ticketId);
    return () => { receptionDraftStore.set(false); };
  }, [ticketId]);

  // Keep-alive: rafraîchit la session Supabase et ping léger toutes les 4 min tant qu'un ticket est ouvert
  useEffect(() => {
    if (!ticketId) return;
    const iv = setInterval(async () => {
      try {
        await supabase.auth.getSession();
        await supabase.from("reception_tickets" as any)
          .select("id", { head: true, count: "exact" }).eq("id", ticketId).limit(1);
      } catch { /* ignore */ }
    }, 4 * 60 * 1000);
    return () => clearInterval(iv);
  }, [ticketId]);

  // Resync immédiat au retour de visibilité
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      qc.invalidateQueries({ queryKey: ["reception_photos", ticketId] });
      qc.invalidateQueries({ queryKey: ["reception_tickets_recent"] });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc, ticketId]);


  // Rafraîchissement live des photos & derniers tickets même si le socket saute.
  useShiftRealtime(
    `reception-photos-${ticketId ?? "none"}`,
    "reception_ticket_photos",
    () => qc.invalidateQueries({ queryKey: ["reception_photos", ticketId] }),
    !!ticketId,
    ticketId ? `ticket_id=eq.${ticketId}` : undefined,
  );
  useShiftRealtime(
    "reception-qualitative-recent",
    "reception_tickets",
    () => {
      qc.invalidateQueries({ queryKey: ["reception_tickets_recent", user?.id] });
      qc.invalidateQueries({ queryKey: ["reception_user_kpis", user?.id] });
    },
  );

  const photoBySlot = useCallback(
    (slot: number) => photos.find((p) => p.slot === slot),
    [photos],
  );
  const nPhotos = photos.length;
  const missingSlots = useMemo(() => [1, 2, 3].filter((s) => !photos.some((p) => p.slot === s)), [photos]);
  const abatValid = useMemo(
    () =>
      form.taux_abattement !== "" &&
      !Number.isNaN(Number(form.taux_abattement)) &&
      Number(form.taux_abattement) >= 0 &&
      Number(form.taux_abattement) <= 100,
    [form.taux_abattement],
  );
  const missingReasons = useMemo(() => {
    const r: string[] = [];
    if (!form.supplier_id) r.push("Fournisseur");
    if (!form.heure_debut) r.push("Heure de début");
    if (!form.heure_fin) r.push("Heure de fin");
    if (missingSlots.length > 0) r.push(`Photo${missingSlots.length > 1 ? "s" : ""} ${missingSlots.join(", ")}`);
    if (!abatValid) r.push("Taux d'abattement");
    return r;
  }, [form.supplier_id, form.heure_debut, form.heure_fin, missingSlots, abatValid]);
  const canClose = !!ticketId && missingReasons.length === 0;
  const selectedSupplier = useMemo(
    () => suppliers.find((s: any) => s.id === form.supplier_id),
    [suppliers, form.supplier_id],
  );



  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 pb-28 md:pb-4">
      <Card className="xl:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Réception qualitative</CardTitle>
            {ticketId && <Badge variant="outline">Ticket en cours</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ligne compacte : Date / N° / Heure début / Heure fin */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="min-w-0">
              <Label className="text-xs">Date</Label>
              <Input className="h-11 w-full" readOnly value={format(new Date(), "yyyy-MM-dd")} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">N° ticket *</Label>
              <div className="flex gap-1 min-w-0">
                <Input
                  className={`h-11 flex-1 min-w-0 ${numeroGap && !gapDismissed ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  value={form.numero}
                  maxLength={50}
                  placeholder="10001"
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                />
                {!!ticketId && form.numero.trim() !== (savedNumero ?? "") && (
                  <Button
                    type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0"
                    title="Enregistrer le nouveau numéro"
                    disabled={renameTicket.isPending || !form.numero.trim()}
                    onClick={() => renameTicket.mutate()}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {numeroProbe && numeroTaken && (
                <p className="text-[11px] text-destructive mt-0.5">Ce numéro de ticket existe déjà.</p>
              )}
              {numeroProbe && !numeroTaken && !numeroChecking && (
                <p className="text-[11px] text-emerald-600 mt-0.5">Numéro disponible.</p>
              )}
              {!!ticketId && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Modifiable jusqu'à la clôture (n° actuel : {savedNumero ?? "—"})
                </p>
              )}
            </div>


            <div className="min-w-0">
              <Label className="text-xs">Heure début *</Label>
              <div className="flex gap-1 min-w-0">
                <Input className="h-11 flex-1 min-w-0" type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} />
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setForm({ ...form, heure_debut: new Date().toTimeString().slice(0, 5) })} title="Maintenant">
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Heure fin *</Label>
              <div className="flex gap-1 min-w-0">
                <Input className="h-11 flex-1 min-w-0" type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} />
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setForm({ ...form, heure_fin: new Date().toTimeString().slice(0, 5) })} title="Maintenant">
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {numeroGap && !gapDismissed && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="text-xs sm:text-sm text-destructive flex-1">
                ⚠️ Vérifiez le numéro de ticket SVP. Un écart de +{numeroGap.gap} a été détecté par rapport au dernier ticket ({numeroGap.last}). Peut-être une erreur de saisie.
              </p>
              <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setGapDismissed(true)}>
                Continuer quand même
              </Button>
            </div>
          )}



          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Campagne</Label>
              <Select value={form.campaign_id} disabled={!!ticketId}
                onValueChange={(v) => setForm({ ...form, campaign_id: v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.libelle} — {c.reception_products?.designation} {c.is_default ? "★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Produit (auto)</Label>
              <Input className="h-11" readOnly value={selectedCampaign?.reception_products?.designation ?? ""} />
            </div>
            <div className="md:col-span-2">
              <Label>Fournisseur agréé *</Label>
              <SupplierCombobox
                suppliers={suppliers as any[]}
                value={form.supplier_id}
                onChange={(v) => setForm({ ...form, supplier_id: v })}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Taux d'abattement (%) *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700"
                  onClick={() => setAdvisorOpen(true)}
                  title="Voir les orientations récentes"
                >
                  <Lightbulb className="h-3.5 w-3.5 mr-1" /> Orientations
                </Button>
              </div>
              <Input className="h-11" type="number" inputMode="decimal" step="0.01" min="0" max="100"
                value={form.taux_abattement}
                onChange={(e) => setForm({ ...form, taux_abattement: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={form.commentaire !== null && form.commentaire !== undefined && (form.commentaire.length > 0 || (form as any)._commentOpen === true)}
                  onCheckedChange={(v) => {
                    if (v) setForm({ ...form, ...( { _commentOpen: true } as any) });
                    else setForm({ ...form, commentaire: "", ...( { _commentOpen: false } as any) });
                  }}
                />
                <span className="text-sm">Ajouter un commentaire</span>
              </label>
              {((form as any)._commentOpen || form.commentaire) && (
                <Textarea
                  placeholder="Commentaire…"
                  value={form.commentaire}
                  onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
                />
              )}
            </div>
          </div>

          {!ticketId && canCreateTicket && (
            <Button
              className="w-full h-12"
              disabled={createTicket.isPending || !form.numero.trim() || !form.campaign_id || !form.supplier_id || numeroTaken === true || heureFormatInvalide}
              onClick={() => createTicket.mutate()}
            >
              Ouvrir le ticket
            </Button>
          )}
          {!ticketId && !canCreateTicket && (
            <div className="text-xs text-muted-foreground text-center py-2">
              Vous n'avez pas le droit de créer un ticket de réception.
            </div>
          )}

          <div className={`space-y-2 rounded-lg p-3 border-2 ${missingSlots.length > 0 && ticketId ? "border-destructive/60 bg-destructive/5" : "border-transparent"}`}>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Photos obligatoires (3)
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Badge variant={nPhotos === 3 ? "default" : "destructive"}>{nPhotos}/3</Badge>
            </div>
            {!ticketId ? (
              <p className="text-xs text-muted-foreground">
                Les 3 photos sont obligatoires avant clôture. Ouvrez d'abord le ticket pour activer la prise de photos.
              </p>
            ) : missingSlots.length > 0 ? (
              <p className="text-xs font-medium text-destructive">
                ⚠ Photo{missingSlots.length > 1 ? "s" : ""} manquante{missingSlots.length > 1 ? "s" : ""} : {missingSlots.join(", ")} — clôture impossible tant que les 3 photos ne sont pas prises.
              </p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((s) => {
                const p = photoBySlot(s);
                return (
                  <PhotoSlot key={s} ticketId={ticketId} ticketNumero={form.numero}
                    supplierName={(selectedSupplier as any)?.nom ?? (selectedSupplier as any)?.name}
                    campaignId={form.campaign_id || null}
                    slot={s as 1 | 2 | 3}
                    disabled={!ticketId || !canCloseTicket}
                    storagePath={p?.storage_path}
                    onUploaded={(path) => addPhoto.mutate({ slot: s, path })}
                    onDeleted={() => p && removePhoto.mutate(p.id)} />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-1">
        <CardHeader className="pb-2">
          <Accordion type="single" collapsible defaultValue="recent" className="xl:pointer-events-none">

            <AccordionItem value="recent" className="border-b-0">
              <AccordionTrigger className="py-0 hover:no-underline xl:[&>svg]:hidden">
                <CardTitle className="text-base">Mon historique (10 derniers)</CardTitle>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-0 space-y-4">
                <div className="overflow-x-auto -mx-2 px-2">
                  <Table>
                    <TableHeader><TableRow className="text-xs">
                      <TableHead className="h-8 px-2">N°</TableHead>
                      <TableHead className="h-8 px-2">Date</TableHead>
                      <TableHead className="h-8 px-2">Fournisseur</TableHead>
                      <TableHead className="h-8 px-2 text-right">Abat.</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {recent.map((t: any) => {
                        const d = t.cloture_at ? new Date(t.cloture_at) : (t.date_ticket ? new Date(t.date_ticket) : null);
                        const dateStr = d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
                        return (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer hover:bg-muted/60"
                            onClick={() => setDetailRow(t)}
                          >
                            <TableCell className="font-mono text-xs py-1.5 px-2 whitespace-nowrap">{t.numero}</TableCell>
                            <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap tabular-nums">{dateStr}</TableCell>
                            <TableCell className="text-xs py-1.5 px-2 truncate max-w-[140px]">{t.fournisseur ?? "—"}</TableCell>
                            <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{Number(t.taux_abattement ?? 0).toFixed(2)} %</TableCell>
                          </TableRow>
                        );
                      })}
                      {recent.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-xs">Aucun ticket clôturé</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mes indicateurs</h4>
                    <Tabs value={period} onValueChange={(v: any) => setPeriod(v)} className="h-8">
                      <TabsList className="h-8 p-0.5">
                        <TabsTrigger value="matin" className="text-[10px] h-7 px-2">Matin</TabsTrigger>
                        <TabsTrigger value="apres_midi" className="text-[10px] h-7 px-2">A-M</TabsTrigger>
                        <TabsTrigger value="nuit" className="text-[10px] h-7 px-2">Nuit</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                      <div className="flex items-center gap-1.5 text-primary mb-1">
                        <TrendingDown className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium uppercase">Abat. Moyen</span>
                      </div>
                      <div className="text-xl font-bold tabular-nums">
                        {kpis ? kpis.avg_abattement_pct.toFixed(2) : "0.00"}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {kpis?.ticket_count ?? 0} tickets pesés
                      </div>
                    </div>
                    <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/10">
                      <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                        <Weight className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium uppercase">Abat. Total</span>
                      </div>
                      <div className="text-xl font-bold tabular-nums">
                        {kpis ? Math.round(kpis.total_abattement_kg).toLocaleString("fr-FR") : "0"} <span className="text-xs font-normal">kg</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Période {period === "matin" ? "6h-14h" : period === "apres_midi" ? "14h-22h" : "22h-6h"}
                        {kpis?.avg_duree ? ` · Durée moy: ${Math.round(kpis.avg_duree)} min` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardHeader>
      </Card>

      {/* Action de clôture toujours accessible */}
      {ticketId && (
        <div className="xl:col-span-3">
          <StickyActionBar>
            {selectedSupplier && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 px-1">
                <Truck className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{selectedSupplier.code}</span>
                <span>·</span>
                <span className="truncate font-medium text-foreground">{selectedSupplier.nom}</span>
              </div>
            )}
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="h-12 shrink-0" disabled={cancelTicket.isPending} title="Annuler le ticket (camion refusé…)">
                    <XCircle className="h-4 w-4 mr-2" />Annuler
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Annuler le ticket ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Les photos seront supprimées et la page réinitialisée. Un motif est requis (camion refusé, erreur de saisie, etc.).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    placeholder="Motif d'annulation (obligatoire)"
                    value={cancelMotif}
                    onChange={(e) => setCancelMotif(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCancelMotif("")}>Retour</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={cancelMotif.trim().length < 3 || cancelTicket.isPending}
                      onClick={(e) => { e.preventDefault(); cancelTicket.mutate(); }}
                    >
                      Confirmer l'annulation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full h-12"
                    disabled={!canClose || closeTicket.isPending || !canCloseTicket}
                    title={missingReasons.length > 0 ? `Manquant : ${missingReasons.join(", ")}` : undefined}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {missingReasons.length > 0
                      ? `Manquant : ${missingReasons.join(", ")}`
                      : "Enregistrer et clôturer"}
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clôturer le ticket ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Après clôture, aucune modification ne sera possible. Le ticket pourra être pesé par le pont-bascule.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => closeTicket.mutate()}>Confirmer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

          </StickyActionBar>
        </div>
      )}

      <TicketDetailDialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)} row={detailRow} />
      <OrientationsAdvisorDialog
        open={advisorOpen}
        onOpenChange={setAdvisorOpen}
        campaignId={form.campaign_id || null}
        productId={(selectedCampaign as any)?.product_id ?? null}
      />
    </div>
  );
}

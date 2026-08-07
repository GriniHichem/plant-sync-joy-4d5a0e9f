import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Lightbulb, User, Clock, ImageOff, Package, ZoomIn } from "lucide-react";
import { formatHm } from "@/lib/reception";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId?: string | null;
  productId?: string | null;
}

type Orientation = {
  id: string;
  taux_recommande: number;
  explication: string | null;
  created_at: string;
  user_id: string;
  author_name: string;
};

type TicketRow = {
  ticket_id: string;
  ticket_numero: string;
  ticket_date: string | null;
  heure_debut: string | null;
  product_id: string | null;
  campaign_id: string | null;
  produit_nom: string | null;
  campagne_nom: string | null;
  taux_applique: number | null;
  poids_net_kg: number | null;
  orientations_count: number;
  taux_moyen: number | null;
  last_orientation_at: string;
  orientations: Orientation[];
};

export function OrientationsAdvisorDialog({ open, onOpenChange, campaignId, productId }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["orientations-advisor-v2", campaignId ?? null, productId ?? null],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("v_reception_ticket_orientations_summary" as any)
        .select("*")
        .order("last_orientation_at", { ascending: false })
        .limit(30);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown) as TicketRow[];
    },
  });

  const ticketIds = useMemo(() => tickets.map((t) => t.ticket_id), [tickets]);

  const { data: photosByTicket = {} } = useQuery({
    queryKey: ["orientations-advisor-photos", ticketIds],
    enabled: open && ticketIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("reception_ticket_photos" as any)
        .select("ticket_id, slot, storage_path")
        .in("ticket_id", ticketIds)
        .order("slot");
      const rows = (data ?? []) as any[];
      const paths = rows.map((r) => r.storage_path);
      const signed = paths.length
        ? (await supabase.storage.from("reception-photos").createSignedUrls(paths, 600)).data ?? []
        : [];
      const urlByPath: Record<string, string> = {};
      signed.forEach((s: any, i: number) => {
        if (s?.signedUrl) urlByPath[paths[i]] = s.signedUrl;
      });
      const map: Record<string, Array<{ slot: number; url: string }>> = {};
      rows.forEach((r) => {
        const url = urlByPath[r.storage_path];
        if (!url) return;
        (map[r.ticket_id] ||= []).push({ slot: r.slot, url });
      });
      return map;
    },
  });

  const globalAvg = tickets.length
    ? (
        tickets.reduce((s, t) => s + (Number(t.taux_moyen) || 0), 0) / tickets.length
      ).toFixed(2)
    : null;

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          <span className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Orientations récentes
          </span>
        }
        description="30 derniers tickets avec avis d'experts pour ce contexte — informatif, vous gardez la décision finale."
        className="max-w-4xl"
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          {globalAvg && (
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-3 text-sm flex items-center justify-between sticky top-0 z-10">
              <span className="text-muted-foreground">
                Moyenne sur {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
              </span>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {globalAvg} %
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : tickets.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground italic">
              Aucune orientation trouvée pour ce contexte.
            </div>
          ) : (
            tickets.map((t) => (
              <TicketCard
                key={t.ticket_id}
                ticket={t}
                photos={photosByTicket[t.ticket_id] ?? []}
                onOpenPhoto={setLightbox}
              />
            ))
          )}
        </div>
      </ResponsiveDialog>

      {lightbox && (
        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-6xl p-2 bg-black/95">
            <img
              src={lightbox}
              alt="Photo agrandie"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function TicketCard({
  ticket,
  photos,
  onOpenPhoto,
}: {
  ticket: TicketRow;
  photos: Array<{ slot: number; url: string }>;
  onOpenPhoto: (url: string) => void;
}) {
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{ticket.ticket_numero}</span>
            <span className="text-sm font-semibold truncate">{ticket.produit_nom ?? "—"}</span>
            {ticket.campagne_nom && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Package className="h-3 w-3" />
                {ticket.campagne_nom}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtDate(ticket.ticket_date)} · {formatHm(ticket.heure_debut)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ticket.taux_moyen != null && (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white tabular-nums">
              Moy. {Number(ticket.taux_moyen).toFixed(2)} %
            </Badge>
          )}
          {ticket.taux_applique != null && (
            <Badge variant="secondary" className="tabular-nums">
              Appliqué : {Number(ticket.taux_applique).toFixed(2)} %
            </Badge>
          )}
        </div>
      </div>

      {/* Photos */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.slot}
              type="button"
              onClick={() => onOpenPhoto(p.url)}
              className="relative group rounded-md overflow-hidden border bg-muted/30"
            >
              <img
                src={p.url}
                alt={`Photo ${p.slot}`}
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
              <ZoomIn className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-white drop-shadow opacity-70 group-hover:opacity-100" />
              <span className="absolute bottom-1 left-1.5 text-[10px] text-white bg-black/60 px-1.5 rounded font-medium">
                {p.slot}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground rounded-md border border-dashed">
          <ImageOff className="h-4 w-4 mr-1.5" />
          Aucune photo
        </div>
      )}

      {/* Orientation tags */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t">
        <span className="text-[11px] text-muted-foreground mr-1">
          {ticket.orientations_count} avis :
        </span>
        {ticket.orientations.map((o) => (
          <OrientationTag key={o.id} o={o} />
        ))}
      </div>
    </div>
  );
}

function OrientationTag({ o }: { o: Orientation }) {
  const fmtDT = (v: string) =>
    new Date(v).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 transition"
        >
          <span className="tabular-nums">{Number(o.taux_recommande).toFixed(1)} %</span>
          <span className="text-muted-foreground font-normal">— {o.author_name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs space-y-2" side="top">
        <div className="flex items-center justify-between gap-2 pb-2 border-b">
          <span className="font-bold text-sm tabular-nums text-amber-700 dark:text-amber-400">
            {Number(o.taux_recommande).toFixed(2)} %
          </span>
          <span className="text-muted-foreground">recommandé</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="h-3 w-3" />
          {o.author_name}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {fmtDT(o.created_at)}
        </div>
        {o.explication ? (
          <div className="whitespace-pre-wrap bg-muted/50 rounded p-2 mt-1">{o.explication}</div>
        ) : (
          <div className="italic text-muted-foreground">Aucune explication fournie.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

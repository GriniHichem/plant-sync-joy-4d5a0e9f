import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { toast } from "sonner";
import { Hash, Images, Loader2, Search, AlertTriangle } from "lucide-react";

export interface MaintenanceTicket {
  id: string;
  numero: string;
  poids_brut_kg?: number | null;
  produit?: string | null;
  fournisseur?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Ticket courant : cible du renommage et du transfert de photos. */
  ticket: MaintenanceTicket | null;
  /** Active l'onglet de transfert de photos (administrateur uniquement). */
  allowPhotoTransfer?: boolean;
  onDone?: () => void;
}

export function TicketMaintenanceDialog({ open, onOpenChange, ticket, allowPhotoTransfer, onDone }: Props) {
  const [numero, setNumero] = useState("");
  const [saving, setSaving] = useState(false);

  const [srcQuery, setSrcQuery] = useState("");
  const [srcResults, setSrcResults] = useState<any[]>([]);
  const [srcLoading, setSrcLoading] = useState(false);
  const [source, setSource] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNumero(ticket?.numero ?? "");
    setSrcQuery(""); setSrcResults([]); setSource(null); setReason("");
  }, [open, ticket?.id]);

  const alreadyWeighed = ticket?.poids_brut_kg != null;

  // Recherche du ticket source (celui qui porte les photos à récupérer).
  useEffect(() => {
    if (!open || !allowPhotoTransfer) return;
    const q = srcQuery.trim();
    if (q.length < 2) { setSrcResults([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      setSrcLoading(true);
      const { data } = await supabase
        .from("v_reception_global")
        .select("id, numero, produit, fournisseur, date_ticket, nb_photos")
        .ilike("numero", `%${q}%`)
        .limit(15);
      if (!cancel) {
        setSrcResults(((data ?? []) as any[]).filter((r) => r.id !== ticket?.id));
        setSrcLoading(false);
      }
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [srcQuery, open, allowPhotoTransfer, ticket?.id]);

  const numeroChanged = useMemo(
    () => numero.trim() !== "" && numero.trim() !== (ticket?.numero ?? ""),
    [numero, ticket?.numero],
  );

  const handleRename = async () => {
    if (!ticket || !numeroChanged) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("rename_reception_ticket" as any, {
        p_ticket_id: ticket.id,
        p_new_numero: numero.trim(),
      });
      if (error) throw error;
      toast.success(`Numéro modifié : ${ticket.numero} → ${numero.trim()}`);
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Modification impossible");
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!ticket || !source) return;
    setTransferring(true);
    try {
      const { data, error } = await supabase.rpc("transfer_reception_ticket_photos" as any, {
        p_source_ticket_id: source.id,
        p_target_ticket_id: ticket.id,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success(
        `${Number(data ?? 0)} photo(s) transférée(s) vers ${ticket.numero}`,
        { description: `Ticket source ${source.numero} supprimé définitivement.` },
      );
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Transfert impossible");
    } finally {
      setTransferring(false);
    }
  };

  const renameTab = (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Ticket actuel : <span className="font-mono text-foreground">{ticket?.numero}</span>
      </div>
      {alreadyWeighed ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          Ce ticket est déjà pesé : le numéro n'est plus modifiable.
        </div>
      ) : (
        <>
          <div>
            <Label>Nouveau numéro de ticket *</Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="h-12 font-mono text-lg"
              placeholder="Ex : 10042"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Le numéro doit être libre. Le changement est tracé dans le commentaire du ticket.
            </p>
          </div>
          <Button className="w-full h-11" disabled={!numeroChanged || saving} onClick={handleRename}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hash className="h-4 w-4 mr-2" />}
            Enregistrer le nouveau numéro
          </Button>
        </>
      )}
    </div>
  );

  const transferTab = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Les photos du ticket source sont rattachées au ticket <span className="font-mono text-foreground">{ticket?.numero}</span>,
        puis le ticket source est <b>supprimé définitivement</b>. Les données du ticket cible restent inchangées.
      </p>
      <div>
        <Label>Ticket source (contenant les photos)</Label>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-11"
            placeholder="Rechercher par numéro…"
            value={srcQuery}
            onChange={(e) => { setSrcQuery(e.target.value); setSource(null); }}
          />
        </div>
        <div className="mt-2 max-h-56 overflow-auto rounded-md border divide-y">
          {srcLoading && <div className="p-3 text-sm text-muted-foreground">Recherche…</div>}
          {!srcLoading && srcResults.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              {srcQuery.trim().length < 2 ? "Saisissez au moins 2 caractères." : "Aucun ticket"}
            </div>
          )}
          {srcResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSource(r)}
              className={`w-full text-left p-2.5 flex items-center gap-2 hover:bg-accent/50 ${source?.id === r.id ? "bg-accent" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-muted-foreground">#{r.numero} · {r.date_ticket}</div>
                <div className="text-sm truncate">{r.produit ?? "—"} — {r.fournisseur ?? "—"}</div>
              </div>
              <Badge variant={Number(r.nb_photos ?? 0) > 0 ? "default" : "outline"} className="shrink-0">
                {Number(r.nb_photos ?? 0)}/3 photos
              </Badge>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Motif (optionnel)</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ex : doublon de saisie manuelle" />
      </div>
      <Button
        className="w-full h-11"
        variant="destructive"
        disabled={!source || transferring}
        onClick={handleTransfer}
      >
        {transferring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Images className="h-4 w-4 mr-2" />}
        Transférer les photos et supprimer le ticket source
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Maintenance ticket"
      description={ticket ? `Ticket ${ticket.numero}` : ""}
      className="max-w-lg"
    >
      {!allowPhotoTransfer ? renameTab : (
        <Tabs defaultValue="numero">
          <TabsList className="w-full">
            <TabsTrigger value="numero" className="flex-1">Numéro</TabsTrigger>
            <TabsTrigger value="photos" className="flex-1">Photos</TabsTrigger>
          </TabsList>
          <TabsContent value="numero" className="mt-3">{renameTab}</TabsContent>
          <TabsContent value="photos" className="mt-3">{transferTab}</TabsContent>
        </Tabs>
      )}
    </ResponsiveDialog>
  );
}

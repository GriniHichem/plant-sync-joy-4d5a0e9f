import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Images, Search } from "lucide-react";

export interface MaintenanceTicket {
  id: string;
  numero: string;
  etat_pesee?: string | null;
  poids_brut_kg?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ticket: MaintenanceTicket | null;
  /** Onglet transfert de photos (administrateur uniquement). */
  allowTransfer?: boolean;
  /** Administrateur : accès total, la renumérotation reste possible même si le ticket est pesé. */
  allowForce?: boolean;
  onDone?: () => void;
}

export function TicketMaintenanceDialog({ open, onOpenChange, ticket, allowTransfer = false, allowForce = false, onDone }: Props) {
  const [numero, setNumero] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [target, setTarget] = useState<MaintenanceTicket | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const weighed = ticket?.etat_pesee === "pese" || (ticket?.poids_brut_kg ?? null) !== null;
  const isWeighed = weighed && !allowForce;

  const { data: candidates = [] } = useQuery({
    queryKey: ["ticket_maintenance_targets", targetSearch],
    enabled: open && allowTransfer && targetSearch.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reception_tickets")
        .select("id, numero")
        .ilike("numero", `%${targetSearch.trim()}%`)
        .order("numero", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as MaintenanceTicket[];
    },
  });

  const rename = useMutation({
    mutationFn: async () => {
      if (!ticket) return;
      const { error } = await supabase.rpc("reception_rename_ticket" as any, {
        p_ticket_id: ticket.id,
        p_new_numero: numero.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Numéro de ticket modifié");
      setNumero("");
      onDone?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Échec de la modification"),
  });

  const transfer = useMutation({
    mutationFn: async () => {
      if (!ticket || !target) return 0;
      const { data, error } = await supabase.rpc("reception_transfer_photos" as any, {
        p_source_id: ticket.id,
        p_target_id: target.id,
        p_delete_source: true,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (n) => {
      toast.success(`${n} photo(s) transférée(s) — ticket source supprimé`);
      setTarget(null); setTargetSearch("");
      onDone?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Échec du transfert"),
  });

  const body = (
    <Tabs defaultValue="numero">
      <TabsList className="w-full">
        <TabsTrigger value="numero" className="flex-1"><Pencil className="h-4 w-4 mr-1" />N° ticket</TabsTrigger>
        {allowTransfer && (
          <TabsTrigger value="photos" className="flex-1"><Images className="h-4 w-4 mr-1" />Photos</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="numero" className="space-y-3 pt-3">
        <div className="text-sm text-muted-foreground">
          Numéro actuel : <span className="font-mono font-semibold text-foreground">{ticket?.numero}</span>
        </div>
        {weighed && allowForce && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Ticket déjà pesé — renumérotation autorisée en accès administrateur (tracée dans le commentaire).
          </p>
        )}
        {isWeighed ? (
          <p className="text-sm text-destructive">Ticket déjà pesé — la renumérotation est interdite.</p>
        ) : (
          <>
            <div>
              <Label>Nouveau numéro *</Label>
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 001417"
                className="h-11 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le numéro doit être libre. La modification est tracée dans le commentaire du ticket.
              </p>
            </div>
            <Button
              className="w-full h-11"
              disabled={!numero.trim() || numero.trim() === ticket?.numero || rename.isPending}
              onClick={() => rename.mutate()}
            >
              Enregistrer le nouveau numéro
            </Button>
          </>
        )}
      </TabsContent>

      {allowTransfer && (
        <TabsContent value="photos" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Les photos du ticket <span className="font-mono">{ticket?.numero}</span> (source) seront déplacées
            vers le ticket cible, puis le ticket source sera <b>supprimé définitivement</b>.
          </p>
          <div>
            <Label>Ticket cible</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-11"
                placeholder="Rechercher un N° de ticket…"
                value={targetSearch}
                onChange={(e) => { setTargetSearch(e.target.value); setTarget(null); }}
              />
            </div>
          </div>
          {target ? (
            <div className="rounded-md border p-3 text-sm flex items-center gap-2">
              Cible : <Badge variant="secondary" className="font-mono">{target.numero}</Badge>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setTarget(null)}>Changer</Button>
            </div>
          ) : (
            <div className="max-h-56 overflow-auto space-y-1">
              {candidates
                .filter((c) => c.id !== ticket?.id)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left rounded-md border p-2 font-mono text-sm active:bg-muted/60 hover:bg-muted/50"
                    onClick={() => setTarget(c)}
                  >
                    {c.numero}
                  </button>
                ))}
              {targetSearch.trim().length >= 2 && candidates.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Aucun ticket trouvé</p>
              )}
            </div>
          )}
          <Button
            variant="destructive"
            className="w-full h-11"
            disabled={!target || transfer.isPending}
            onClick={() => setConfirmTransfer(true)}
          >
            Transférer les photos et supprimer le ticket source
          </Button>
        </TabsContent>
      )}
    </Tabs>
  );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Maintenance ticket"
        description={ticket ? `Ticket ${ticket.numero}` : ""}
        className="max-w-lg"
      >
        {body}
      </ResponsiveDialog>

      <AlertDialog open={confirmTransfer} onOpenChange={setConfirmTransfer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le transfert ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les photos de <b>{ticket?.numero}</b> seront déplacées vers <b>{target?.numero}</b>, puis le
              ticket <b>{ticket?.numero}</b> sera supprimé définitivement. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => transfer.mutate()}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

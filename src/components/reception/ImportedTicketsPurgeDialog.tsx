import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RANGES = [4, 8, 12] as const;
type Range = (typeof RANGES)[number];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}

export function ImportedTicketsPurgeDialog({ open, onOpenChange, onDeleted }: Props) {
  const [hours, setHours] = useState<Range>(4);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const refreshCount = useCallback(async (h: Range) => {
    setCounting(true);
    setCount(null);
    const { data, error } = await supabase.rpc("reception_count_imported_tickets" as any, { p_hours: h });
    if (error) toast.error(error.message);
    setCount(error ? null : Number(data ?? 0));
    setCounting(false);
  }, []);

  useEffect(() => {
    if (!open) { setConfirming(false); return; }
    refreshCount(hours);
  }, [open, hours, refreshCount]);

  const handleDelete = async () => {
    setDeleting(true);
    const { data, error } = await supabase.rpc("reception_delete_imported_tickets" as any, { p_hours: hours });
    setDeleting(false);
    if (error) {
      toast.error(error.message ?? "Suppression impossible");
      return;
    }
    const n = Number(data ?? 0);
    toast.success(
      n > 0
        ? `${n} ticket(s) importé(s) supprimé(s) — plage ${hours} h`
        : "Aucun ticket importé à supprimer sur cette plage",
    );
    setConfirming(false);
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Supprimer les tickets importés
          </DialogTitle>
          <DialogDescription className="text-xs">
            Seuls les tickets au statut <strong>pesé importé</strong> (créés via importation CSV) sont
            concernés. Les tickets saisis manuellement ne sont jamais supprimés.
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Ancienneté des tickets importés</Label>
              <RadioGroup
                value={String(hours)}
                onValueChange={(v) => setHours(Number(v) as Range)}
                className="grid grid-cols-3 gap-2"
              >
                {RANGES.map((h) => (
                  <Label
                    key={h}
                    htmlFor={`purge-${h}`}
                    className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary"
                  >
                    <RadioGroupItem id={`purge-${h}`} value={String(h)} />
                    <span className="text-sm">{h} heures</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center gap-2">
              {counting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Calcul en cours…
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Tickets concernés :</span>
                  <strong>{count ?? "—"}</strong>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={counting || !count}
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Cette action est irréversible. Voulez-vous vraiment supprimer {count} tickets importés ?
                <div className="mt-1 text-xs opacity-90">Plage sélectionnée : {hours} heures</div>
              </AlertDescription>
            </Alert>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={deleting} onClick={() => setConfirming(false)}>
                Annuler
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirmer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

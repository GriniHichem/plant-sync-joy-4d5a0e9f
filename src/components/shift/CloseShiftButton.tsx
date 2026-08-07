import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveShift } from "@/contexts/ActiveShiftContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogOut } from "lucide-react";
import { logAudit } from "@/lib/audit";

/**
 * Operator-side "Close my shift" action available in every shift kiosk.
 * - Requires observations (server-side trigger also enforces it for quality_shifts).
 * - On success, the user is redirected to /apps with a toast.
 * - The responsable still has the override "Force close" path on the console.
 */
export function CloseShiftButton() {
  const { kind, productionShift, maintenanceShift, qualityShift, refresh } = useActiveShift();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [observations, setObservations] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeId =
    kind === "production" ? productionShift?.id :
    kind === "maintenance" ? maintenanceShift?.id :
    kind === "quality" ? qualityShift?.id : null;

  if (!activeId) return null;

  const tableName =
    kind === "production" ? "shifts" :
    kind === "maintenance" ? "maintenance_shifts" :
    "quality_shifts";

  async function handleClose() {
    if (!activeId) return;
    if (!observations.trim()) {
      toast({ title: "Observations requises pour clôturer", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from(tableName as any)
        .update({
          is_active: false,
          heure_fin: new Date().toISOString(),
          observations: observations.trim(),
        } as any)
        .eq("id", activeId);
      if (error) throw error;

      const auditModule =
        kind === "production" ? "gpao" :
        kind === "maintenance" ? "interventions" :
        "qualite";
      await logAudit({
        action_type: "update",
        module: auditModule as any,
        entity_type: `${kind}_shift`,
        entity_id: activeId,
        action_label: "Clôture de shift par l'opérateur (kiosque)",
        new_values: { closed_by: "operator", observations: observations.trim() },
      });

      toast({ title: "Shift clôturé" });
      setOpen(false);
      await refresh();
      navigate("/apps");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="h-9">
          <LogOut className="h-4 w-4 mr-1.5" /> Clôturer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôturer mon shift</DialogTitle>
          <DialogDescription>
            Cette action termine votre session de shift. Un bilan sera disponible pour votre responsable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Observations de fin de shift *</Label>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={4}
            placeholder="Synthèse, points d'attention, passation..."
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleClose} disabled={submitting || !observations.trim()}>
            {submitting ? "Clôture..." : "Confirmer la clôture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

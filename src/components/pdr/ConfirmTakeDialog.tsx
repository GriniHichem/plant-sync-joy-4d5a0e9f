import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { PdrRequest, PdrRequestItem } from "@/hooks/usePdrRequests";

interface Props {
  open: boolean;
  request: PdrRequest | null;
  item: PdrRequestItem | null;
  busy?: boolean;
  onConfirm: (qte: number) => void;
  onCancel: () => void;
}

export function ConfirmTakeDialog({ open, request, item, busy, onConfirm, onCancel }: Props) {
  const prepared = item?.quantite_preparee ?? item?.quantite_demandee ?? 1;
  const [qte, setQte] = useState<number>(prepared);
  const [familyLabel, setFamilyLabel] = useState<string>("—");

  useEffect(() => {
    setQte(prepared);
  }, [prepared, item?.id]);

  // Résolution famille › sous-famille pour la pièce
  useEffect(() => {
    let cancelled = false;
    if (!open || !item?.pdr_id) {
      setFamilyLabel("—");
      return;
    }
    (async () => {
      const { data: pdr } = await supabase
        .from("pdr")
        .select("family_id")
        .eq("id", item.pdr_id)
        .maybeSingle();
      const familyId = (pdr as any)?.family_id as string | null;
      if (!familyId) {
        if (!cancelled) setFamilyLabel("—");
        return;
      }
      const { data: fams } = await supabase
        .from("pdr_families" as any)
        .select("id, name, parent_id");
      const map = new Map<string, { name: string; parent_id: string | null }>();
      ((fams as any[]) || []).forEach((f) => map.set(f.id, { name: f.name, parent_id: f.parent_id }));
      const node = map.get(familyId);
      if (!node) {
        if (!cancelled) setFamilyLabel("—");
        return;
      }
      const parts: string[] = [node.name];
      if (node.parent_id && map.get(node.parent_id)) parts.unshift(map.get(node.parent_id)!.name);
      if (!cancelled) setFamilyLabel(parts.join(" › "));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item?.pdr_id]);

  const dispo = useMemo(() => {
    if (!item?.pdr) return 0;
    return (item.pdr.stock_actuel ?? 0) - (item.pdr.stock_reserve ?? 0);
  }, [item]);

  const reliquat = Math.max(0, (item?.quantite_demandee ?? 0) - qte);
  const max = prepared;

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Confirmer la prise{request ? ` — ${request.numero}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Réf.</span>
              <span className="font-mono text-sm font-semibold">{item.pdr?.reference}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Désignation</span>
              <span className="text-sm">{item.pdr?.designation}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Famille</span>
              <span className="text-sm">{familyLabel}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Demandée" value={item.quantite_demandee} />
            <Stat label="Disponible" value={dispo} />
            <Stat label="Préparée" value={prepared} />
            <div className="rounded-lg border p-2.5">
              <p className="text-[11px] text-muted-foreground">Reliquat attendu</p>
              <p className={`text-lg font-semibold tabular-nums ${reliquat > 0 ? "text-amber-600" : ""}`}>
                {reliquat}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs">Qté à prendre</Label>
            <Input
              type="number"
              min={1}
              max={max}
              value={qte}
              onChange={(e) =>
                setQte(Math.min(max, Math.max(1, parseInt(e.target.value, 10) || 1)))
              }
              className="h-11 w-28 tabular-nums"
            />
            {reliquat > 0 && (
              <Badge variant="outline" className="mt-2 text-[10px] text-amber-600 border-amber-600/40">
                Prise partielle — {reliquat} restant(s) à fournir
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(qte)} disabled={busy} className="min-h-[44px]">
            {busy ? "Confirmation…" : "Confirmer la prise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

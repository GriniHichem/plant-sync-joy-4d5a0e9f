import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Lightbulb, Trash2, ArrowUpDown, User, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ticketId: string;
}

interface Orientation {
  id: string;
  ticket_id: string;
  user_id: string;
  taux_recommande: number;
  explication: string | null;
  created_at: string;
  author_name: string;
}

export function TicketOrientations({ ticketId }: Props) {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [taux, setTaux] = useState("");
  const [expl, setExpl] = useState("");
  const [desc, setDesc] = useState(true);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["orientations", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_reception_orientations" as any)
        .select("id, ticket_id, user_id, taux_recommande, explication, created_at, author_name")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Orientation[];
    },
  });

  const sorted = [...rows].sort((a, b) =>
    desc
      ? +new Date(b.created_at) - +new Date(a.created_at)
      : +new Date(a.created_at) - +new Date(b.created_at),
  );

  const mine = rows.find((r) => r.user_id === user?.id);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      const val = Number(String(taux).replace(",", "."));
      if (!Number.isFinite(val) || val < 0 || val > 100) {
        throw new Error("Taux invalide (0–100)");
      }
      const payload = {
        ticket_id: ticketId,
        user_id: user.id,
        taux_recommande: val,
        explication: expl.trim() || null,
      };
      const { error } = await supabase
        .from("reception_ticket_orientations" as any)
        .upsert(payload, { onConflict: "ticket_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(mine ? "Orientation mise à jour" : "Orientation ajoutée");
      setTaux("");
      setExpl("");
      qc.invalidateQueries({ queryKey: ["orientations", ticketId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reception_ticket_orientations" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orientation supprimée");
      qc.invalidateQueries({ queryKey: ["orientations", ticketId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const fmtDT = (v: string) =>
    new Date(v).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" /> Orientations ({rows.length})
        </h3>
        {rows.length > 1 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDesc((d) => !d)}>
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {desc ? "Plus récent" : "Plus ancien"}
          </Button>
        )}
      </div>

      {/* Badges list */}
      <div className="rounded-lg border p-3 bg-muted/20 min-h-[52px]">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Chargement…</div>
        ) : sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Aucune orientation pour le moment.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((o) => (
              <Popover key={o.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
                  >
                    <Badge
                      variant={o.user_id === user?.id ? "default" : "secondary"}
                      className="cursor-pointer hover:opacity-90 tabular-nums"
                    >
                      {Number(o.taux_recommande).toFixed(2)} %
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-sm space-y-2" side="top">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold tabular-nums text-primary">
                      {Number(o.taux_recommande).toFixed(2)} %
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => remove.mutate(o.id)}
                        title="Supprimer (admin)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {o.author_name}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {fmtDT(o.created_at)}
                  </div>
                  {o.explication ? (
                    <div className="text-xs whitespace-pre-wrap border-t pt-2">{o.explication}</div>
                  ) : (
                    <div className="text-xs italic text-muted-foreground border-t pt-2">
                      Aucune explication fournie.
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="rounded-lg border p-3 space-y-2 bg-background">
        <div className="text-xs font-medium text-muted-foreground">
          {mine ? "Mettre à jour mon orientation" : "Ajouter mon orientation"}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Taux recommandé (%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              max={100}
              placeholder={mine ? String(mine.taux_recommande) : "5"}
              value={taux}
              onChange={(e) => setTaux(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Explication (facultatif)</Label>
            <Textarea
              rows={1}
              placeholder={mine?.explication ?? "Ex. lot très mûr sur photo 2…"}
              value={expl}
              onChange={(e) => setExpl(e.target.value)}
              className="min-h-9 py-2"
            />
          </div>
          <Button
            onClick={() => upsert.mutate()}
            disabled={upsert.isPending || !taux}
            size="sm"
          >
            {mine ? "Mettre à jour" : "Ajouter"}
          </Button>
        </div>
      </div>
    </section>
  );
}

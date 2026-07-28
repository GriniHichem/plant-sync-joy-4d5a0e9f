import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Scale, Search, ChevronRight, ArrowUpDown, Wrench } from "lucide-react";
import { computeAbattementKg, computeNetKg, formatKg, kgToTonnes } from "@/lib/reception";
import { PhotoLightbox } from "./PhotoLightbox";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { ScrollTable } from "@/components/responsive/ScrollTable";
import { StickyActionBar } from "@/components/responsive/StickyActionBar";
import { TicketMaintenanceDialog } from "./TicketMaintenanceDialog";

export default function ReceptionQuantitative() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [poidsBrut, setPoidsBrut] = useState("");
  const [codeSaisi, setCodeSaisi] = useState("");

  const { data: tickets = [], isFetching } = useQuery({
    queryKey: ["reception_pesee_list", limit, sortAsc],
    queryFn: async () => {
      // Seuls les tickets clôturés non encore pesés remontent au pont-bascule.
      const { data, error } = await supabase.from("v_reception_global")
        .select("*").eq("statut", "cloture").is("poids_brut_kg", null)
        .order("numero", { ascending: sortAsc })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reception_pesee_list"] });
  useShiftRealtime("reception-pesee-tickets", "reception_tickets", invalidate);
  useShiftRealtime("reception-pesee-weighings", "reception_weighings", invalidate);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t: any) =>
      [t.numero, t.fournisseur, t.produit, t.wilaya].some((x) => (x ?? "").toString().toLowerCase().includes(q)),
    );
  }, [tickets, search]);


  // Formatage du code système : préfixe + zéros + numéro saisi
  const digits = selected?.code_digits ? Math.max(1, Math.min(10, Number(selected.code_digits))) : null;
  const prefix = selected?.code_prefix ?? "";
  const saisiClean = codeSaisi.replace(/\D/g, "");
  const codeFormatted = digits && saisiClean
    ? `${prefix}${saisiClean.padStart(digits, "0").slice(-digits)}`
    : "";
  const codeConfigured = !!(digits && prefix);

  const savePesee = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const brut = Number(poidsBrut);
      if (!brut || brut <= 0) throw new Error("Poids brut invalide");
      if (codeConfigured && !saisiClean) throw new Error("Numéro système requis");
      const payload: any = {
        ticket_id: selected.id,
        poids_brut_kg: brut,
        taux_abattement_snapshot: Number(selected.taux_abattement),
      };
      if (codeConfigured) {
        payload.code_saisi = codeFormatted;
        payload.code_pesee = codeFormatted;
      }
      const { error } = await supabase.from("reception_weighings" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesée enregistrée");
      setSelected(null); setPoidsBrut(""); setCodeSaisi("");
      qc.invalidateQueries({ queryKey: ["reception_pesee_list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const brut = Number(poidsBrut || 0);
  const taux = selected ? Number(selected.taux_abattement) : 0;
  const abat = computeAbattementKg(brut, taux);
  const net = computeNetKg(brut, taux);

  const detailPanel = selected && (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground">N° </span><span className="font-mono">{selected.numero}</span></div>
        <div><span className="text-muted-foreground">Date </span>{selected.date_ticket}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Produit </span>{selected.produit}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Fournisseur </span>{selected.fournisseur}</div>
        <div><span className="text-muted-foreground">Début </span>{selected.heure_debut ?? "—"}</div>
        <div><span className="text-muted-foreground">Fin </span>{selected.heure_fin ?? "—"}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Abattement </span>{Number(selected.taux_abattement).toFixed(2)} %</div>
      </div>

      <PhotoLightbox ticketId={selected.id} />

      {selected.etat_pesee === "pese" ? (
        <div className="rounded-md border p-3 space-y-1 text-sm">
          <div className="font-semibold">{selected.code_pesee}</div>
          <div>Brut : {formatKg(selected.poids_brut_kg)}</div>
          <div>Abattement : {formatKg(selected.poids_abattement_kg)}</div>
          <div className="font-semibold">Net : {formatKg(selected.poids_net_kg)} ({kgToTonnes(selected.poids_net_kg)} t)</div>
        </div>
      ) : (
        <>
          {codeConfigured && (
            <div>
              <Label>Numéro système *</Label>
              <div className="flex items-center gap-2">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={codeSaisi}
                  onChange={(e) => setCodeSaisi(e.target.value.replace(/\D/g, "").slice(0, digits!))}
                  placeholder={`Ex: ${"16".slice(0, digits!)}`}
                  className="h-12 text-lg font-mono"
                  maxLength={digits!}
                />
                <Badge variant={codeFormatted ? "default" : "outline"} className="font-mono text-sm">
                  {codeFormatted || `${prefix}${"".padStart(digits!, "_")}`}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Préfixe <b>{prefix}</b> + {digits} chiffres.</p>
            </div>
          )}
          <div>
            <Label>Poids brut (kg) *</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={poidsBrut}
              onChange={(e) => setPoidsBrut(e.target.value)}
              className="h-14 text-2xl font-semibold"
              autoFocus={!codeConfigured}
            />
          </div>
          <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/30">
            <div>Abattement : <span className="font-semibold">{formatKg(abat)}</span></div>
            <div>Poids net : <span className="font-semibold">{formatKg(net)}</span> ({kgToTonnes(net)} t)</div>
          </div>
          <StickyActionBar>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full h-12" disabled={!brut || savePesee.isPending || (codeConfigured && !saisiClean)}>
                  <Scale className="h-4 w-4 mr-2" />Valider la pesée
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la pesée ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Brut {formatKg(brut)} — abattement {formatKg(abat)} — <b>net {formatKg(net)}</b>. Après validation, la pesée est verrouillée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => savePesee.mutate()}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </StickyActionBar>
        </>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base md:text-lg">Tickets à peser</CardTitle>
            <Badge variant="outline">{filtered.length} en attente</Badge>
            <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="h-10 shrink-0"
                onClick={() => setSortAsc((v) => !v)}
                title="Trier par numéro de ticket"
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                N° {sortAsc ? "croissant" : "décroissant"}
              </Button>
              <div className="relative flex-1 sm:w-64">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-10" placeholder="N°, fournisseur, produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

        </CardHeader>
        <CardContent>
          {/* Mobile / tablette portrait : liste condensée */}
          <div className="lg:hidden space-y-2">
            {filtered.map((t: any) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSelected(t); setPoidsBrut(""); setCodeSaisi(""); }}
                className="w-full text-left rounded-lg border p-3 flex items-center gap-3 active:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground truncate">{t.numero}</span>
                    {t.etat_pesee === "pese"
                      ? <Badge variant="secondary" className="h-5">{formatKg(t.poids_net_kg)} net</Badge>
                      : <Badge className="h-5">À peser</Badge>}
                  </div>
                  <div className="font-medium truncate">{t.produit}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.fournisseur} · Abat. {Number(t.taux_abattement).toFixed(2)} %</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {isFetching ? "Chargement…" : "Aucun ticket"}
              </div>
            )}
          </div>

          {/* Desktop : table classique */}
          <div className="hidden lg:block">
            <ScrollTable>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>N°</TableHead><TableHead>Produit</TableHead>
                  <TableHead>Fournisseur</TableHead><TableHead>Abat.</TableHead>
                  <TableHead>État</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((t: any) => (
                    <TableRow key={t.id} className={selected?.id === t.id ? "bg-muted" : ""}>
                      <TableCell className="font-mono text-xs">{t.numero}</TableCell>
                      <TableCell>{t.produit}</TableCell>
                      <TableCell>{t.fournisseur}</TableCell>
                      <TableCell>{Number(t.taux_abattement).toFixed(2)} %</TableCell>
                      <TableCell>
                        {t.etat_pesee === "pese"
                          ? <Badge variant="secondary">{formatKg(t.poids_net_kg)} net</Badge>
                          : <Badge>À peser</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setSelected(t); setPoidsBrut(""); setCodeSaisi(""); }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {isFetching ? "Chargement…" : "Aucun ticket"}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollTable>
          </div>

          <div className="flex justify-center pt-3">
            <Button variant="outline" onClick={() => setLimit((l) => l + 20)}>Charger 20 de plus</Button>
          </div>
        </CardContent>
      </Card>

      {/* Desktop side panel */}
      <Card className="hidden lg:block">
        <CardHeader><CardTitle>Détail &amp; pesée</CardTitle></CardHeader>
        <CardContent>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Sélectionnez un ticket pour saisir la pesée.</p>
          ) : detailPanel}
        </CardContent>
      </Card>

      {/* Mobile/tablet : drawer plein-écran */}
      {isMobile !== undefined && (
        <ResponsiveDialog
          open={!!selected && (typeof window === "undefined" || window.innerWidth < 1024)}
          onOpenChange={(o) => { if (!o) { setSelected(null); setPoidsBrut(""); setCodeSaisi(""); } }}
          title={selected ? `Ticket ${selected.numero}` : ""}
          description={selected?.produit}
          className="max-w-lg"
          bodyClassName="space-y-3"
        >
          {detailPanel}
        </ResponsiveDialog>
      )}
    </div>
  );
}

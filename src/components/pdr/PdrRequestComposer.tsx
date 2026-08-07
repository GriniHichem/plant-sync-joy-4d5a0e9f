import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, PackageSearch, Send, CheckCircle2, XCircle } from "lucide-react";
import { createPdrRequest, type PdrRequestType } from "@/hooks/usePdrRequests";

interface PdrRow {
  id: string;
  reference: string;
  designation: string;
  stock_actuel: number;
  stock_reserve: number;
  family_id: string | null;
  sous_famille: string | null;
  unite_stock: string | null;
}
interface FamilyRow { id: string; name: string; parent_id: string | null; }

interface CartLine { pdr: PdrRow; qte: number; dispo: boolean; commentaire: string; }

interface Props {
  type: PdrRequestType;
  ticketId?: string | null;
  preventivePlanId?: string | null;
  machineId?: string | null;
  ligneId?: string | null;
  onSubmitted?: (requestId: string) => void;
}

const NONE = "__all__";

export function PdrRequestComposer({ type, ticketId, preventivePlanId, machineId, ligneId, onSubmitted }: Props) {
  const { toast } = useToast();
  const [pdrList, setPdrList] = useState<PdrRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [famille, setFamille] = useState<string>(NONE);
  const [sousFamille, setSousFamille] = useState<string>(NONE);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [priorite, setPriorite] = useState("normale");
  const [commentaire, setCommentaire] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("pdr").select("id, reference, designation, stock_actuel, stock_reserve, family_id, sous_famille, unite_stock")
      .eq("is_active", true).order("reference")
      .then(({ data }) => setPdrList((data as any) || []));
    supabase.from("pdr_families" as any).select("id, name, parent_id").eq("is_active", true).order("name")
      .then(({ data }) => setFamilies((data as any) || []));
  }, []);

  const topFamilies = useMemo(() => families.filter((f) => !f.parent_id), [families]);
  const subFamilies = useMemo(
    () => (famille === NONE ? [] : families.filter((f) => f.parent_id === famille)),
    [families, famille],
  );

  const dispo = (p: PdrRow) => (p.stock_actuel ?? 0) - (p.stock_reserve ?? 0);

  const familyIdsForFilter = useMemo(() => {
    if (sousFamille !== NONE) return new Set([sousFamille]);
    if (famille !== NONE) return new Set([famille, ...subFamilies.map((s) => s.id)]);
    return null;
  }, [famille, sousFamille, subFamilies]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pdrList.filter((p) => {
      if (familyIdsForFilter && (!p.family_id || !familyIdsForFilter.has(p.family_id))) return false;
      if (s && !`${p.reference} ${p.designation}`.toLowerCase().includes(s)) return false;
      return true;
    }).slice(0, 60);
  }, [pdrList, familyIdsForFilter, search]);

  const inCart = (id: string) => cart.some((c) => c.pdr.id === id);

  const addToCart = (p: PdrRow) => {
    if (inCart(p.id)) return;
    setCart((c) => [...c, { pdr: p, qte: 1, dispo: dispo(p) >= 1, commentaire: "" }]);
  };
  const updateLine = (id: string, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l) => (l.pdr.id === id ? { ...l, ...patch, dispo: dispo(l.pdr) >= (patch.qte ?? l.qte) } : l)));
  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.pdr.id !== id));

  const handleSubmit = async () => {
    if (cart.length === 0) { toast({ title: "Ajoutez au moins une pièce", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const requestId = await createPdrRequest({
        type, ticket_id: ticketId, preventive_plan_id: preventivePlanId,
        machine_id: machineId, ligne_id: ligneId, priorite, commentaire: commentaire || null,
        items: cart.map((l) => ({
          pdr_id: l.pdr.id, quantite_demandee: l.qte, dispo_snapshot: dispo(l.pdr) >= l.qte, commentaire: l.commentaire || null,
        })),
      });
      toast({ title: "Demande envoyée au magasin" });
      setCart([]); setCommentaire("");
      onSubmitted?.(requestId);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Famille</Label>
          <Select value={famille} onValueChange={(v) => { setFamille(v); setSousFamille(NONE); }}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Toutes les familles</SelectItem>
              {topFamilies.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sous-famille</Label>
          <Select value={sousFamille} onValueChange={setSousFamille} disabled={famille === NONE || subFamilies.length === 0}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Toutes</SelectItem>
              {subFamilies.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Recherche</Label>
          <Input className="h-11" placeholder="Réf. / désignation" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Results */}
      <div className="border rounded-lg divide-y max-h-72 overflow-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-30" /> Aucune pièce
          </div>
        )}
        {filtered.map((p) => {
          const d = dispo(p);
          return (
            <div key={p.id} className="flex items-center gap-3 p-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-semibold truncate">{p.reference}</p>
                <p className="text-xs text-muted-foreground truncate">{p.designation}</p>
              </div>
              {d > 0 ? (
                <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-600/40">
                  <CheckCircle2 className="h-3 w-3" /> Disponible ({d})
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/40">
                  <XCircle className="h-3 w-3" /> Non disponible
                </Badge>
              )}
              <Button size="sm" variant="outline" className="h-9" disabled={inCart(p.id)} onClick={() => addToCart(p)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
          <p className="text-sm font-semibold">Pièces demandées ({cart.length})</p>
          {cart.map((l) => {
            const d = dispo(l.pdr);
            return (
              <div key={l.pdr.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-semibold truncate">{l.pdr.reference}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{l.pdr.designation}</p>
                </div>
                <Input
                  type="number" min={1} value={l.qte}
                  onChange={(e) => updateLine(l.pdr.id, { qte: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="h-10 w-20 tabular-nums"
                />
                {d >= l.qte
                  ? <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-600/40">Dispo</Badge>
                  : <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">Non dispo</Badge>}
                <Button size="sm" variant="ghost" className="h-9 text-destructive" onClick={() => removeLine(l.pdr.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Priorité</Label>
          <Select value={priorite} onValueChange={setPriorite}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basse">Basse</SelectItem>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="critique">Critique</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Commentaire</Label>
          <Textarea rows={1} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Précisions pour le magasin…" />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={submitting || cart.length === 0} className="w-full min-h-[48px]">
        <Send className="h-4 w-4 mr-2" /> {submitting ? "Envoi…" : "Envoyer la demande au magasin"}
      </Button>
    </div>
  );
}

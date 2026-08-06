import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import QualityIndicatorAssignments from "@/components/qualite/QualityIndicatorAssignments";
import OfControlPlanManager from "@/components/qualite/OfControlPlanManager";

interface OfRow {
  id: string;
  numero: string;
  statut: string;
  product_id: string | null;
  products: { code: string | null; designation: string | null } | null;
}

export default function QualiteAffectations() {
  const { canEdit } = usePermissions();
  const [ofs, setOfs] = useState<OfRow[]>([]);
  const [ofId, setOfId] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("ordres_fabrication")
        .select("id, numero, statut, product_id, products(code, designation)")
        .order("created_at", { ascending: false })
        .limit(300);
      setOfs(data || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ofs;
    return ofs.filter((o) =>
      `${o.numero} ${o.products?.code ?? ""} ${o.products?.designation ?? ""}`.toLowerCase().includes(s),
    );
  }, [ofs, q]);

  const canManage = canEdit("qualite_indicateurs");
  const selected = ofs.find((o) => o.id === ofId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Affectation des contrôles</h1>
          <p className="text-muted-foreground text-sm">
            Affectez les contrôles aux produits finis (héritage automatique sur tous leurs OF) ou directement à un OF.
          </p>
        </div>
      </div>

      <Tabs defaultValue="produit">
        <TabsList>
          <TabsTrigger value="produit">Par produit / famille / ligne</TabsTrigger>
          <TabsTrigger value="of">Par ordre de fabrication</TabsTrigger>
        </TabsList>

        <TabsContent value="produit" className="mt-4">
          <QualityIndicatorAssignments />
        </TabsContent>

        <TabsContent value="of" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Rechercher un OF</Label>
                <Input placeholder="N° OF ou produit…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ordre de fabrication</Label>
                <Select value={ofId} onValueChange={setOfId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un OF…" /></SelectTrigger>
                  <SelectContent>
                    {filtered.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.numero} — {o.products?.designation ?? o.products?.code ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {ofId ? (
            <OfControlPlanManager ofId={ofId} ofNumero={selected?.numero} canManage={canManage} />
          ) : (
            <p className="text-sm text-muted-foreground">Sélectionnez un OF pour voir et ajuster son plan de contrôle.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
